// ============================================================
// KNOWLEDGE BASE CONTROLLER
// Handles KB articles, categories, FAQs, announcements, search
// ============================================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// ── helper: slugify ──────────────────────────────────────────
function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// ─────────────────────────────────────────────────────────────
//  CATEGORIES
// ─────────────────────────────────────────────────────────────

const getCategories = async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT
        c.category_id,
        c.name,
        c.slug,
        c.description,
        c.icon,
        c.color,
        c.sort_order,
        (SELECT COUNT(*) FROM kb_articles a
         WHERE a.category_id = c.category_id AND a.status = 'published') AS article_count
      FROM kb_categories c
      WHERE c.is_active = 1
      ORDER BY c.sort_order, c.name
    `);
    return res.json(createResponse(true, 'Categories fetched', result.recordset));
  } catch (e) {
    logger.error('getCategories error', { error: e.message });
    return res.status(500).json(createResponse(false, 'Failed to fetch categories'));
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description, icon, color, sort_order } = req.body;
    if (!name) return res.status(400).json(createResponse(false, 'Name required'));
    const slug = slugify(name);
    await executeQuery(`
      INSERT INTO kb_categories (name, slug, description, icon, color, sort_order)
      VALUES (@name, @slug, @desc, @icon, @color, @sort)
    `, { name, slug, desc: description || null, icon: icon || null, color: color || '#6366f1', sort: sort_order || 0 });
    return res.status(201).json(createResponse(true, 'Category created'));
  } catch (e) {
    logger.error('createCategory error', { error: e.message });
    return res.status(500).json(createResponse(false, e.message));
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, color, sort_order, is_active } = req.body;
    await executeQuery(`
      UPDATE kb_categories SET
        name        = COALESCE(@name, name),
        description = COALESCE(@desc, description),
        icon        = COALESCE(@icon, icon),
        color       = COALESCE(@color, color),
        sort_order  = COALESCE(@sort, sort_order),
        is_active   = COALESCE(@active, is_active),
        updated_at  = GETUTCDATE()
      WHERE category_id = @id
    `, { name: name || null, desc: description || null, icon: icon || null, color: color || null, sort: sort_order ?? null, active: is_active ?? null, id });
    return res.json(createResponse(true, 'Category updated'));
  } catch (e) {
    logger.error('updateCategory error', { error: e.message });
    return res.status(500).json(createResponse(false, e.message));
  }
};

// ─────────────────────────────────────────────────────────────
//  ARTICLES
// ─────────────────────────────────────────────────────────────

const getArticles = async (req, res) => {
  try {
    const { category, search, status = 'published', limit = 50, offset = 0 } = req.query;
    let where = `WHERE a.status = @status`;
    const params = { status, limit: parseInt(limit), offset: parseInt(offset) };

    if (category) { where += ` AND c.slug = @category`; params.category = category; }
    if (search) {
      where += ` AND (a.title LIKE @q OR a.description LIKE @q OR a.tags LIKE @q)`;
      params.q = `%${search}%`;
    }

    const result = await executeQuery(`
      SELECT
        a.article_id, a.title, a.slug, a.description, a.icon, a.tags,
        a.difficulty, a.read_time, a.status, a.views, a.helpful_yes, a.helpful_no,
        a.published_at, a.updated_at, a.sort_order,
        c.name AS category_name, c.slug AS category_slug, c.color AS category_color,
        c.icon AS category_icon,
        u.first_name + ' ' + u.last_name AS author_name
      FROM kb_articles a
      JOIN kb_categories c ON a.category_id = c.category_id
      JOIN users u ON a.created_by = u.user_id
      ${where}
      ORDER BY a.sort_order, a.views DESC, a.updated_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `, params);

    return res.json(createResponse(true, 'Articles fetched', result.recordset));
  } catch (e) {
    logger.error('getArticles error', { error: e.message });
    return res.status(500).json(createResponse(false, 'Failed to fetch articles'));
  }
};

const getArticleBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await executeQuery(`
      SELECT
        a.article_id, a.title, a.slug, a.description, a.content, a.icon, a.tags,
        a.difficulty, a.read_time, a.status, a.views, a.helpful_yes, a.helpful_no,
        a.published_at, a.updated_at, a.category_id,
        c.name AS category_name, c.slug AS category_slug,
        u.first_name + ' ' + u.last_name AS author_name
      FROM kb_articles a
      JOIN kb_categories c ON a.category_id = c.category_id
      JOIN users u ON a.created_by = u.user_id
      WHERE a.slug = @slug AND a.status = 'published'
    `, { slug });

    if (!result.recordset.length) {
      return res.status(404).json(createResponse(false, 'Article not found'));
    }
    const article = result.recordset[0];

    // Track view (one per user per day, ignore duplicate constraint errors)
    try {
      const userId = req.user?.user_id || null;
      const today = new Date().toISOString().split('T')[0];

      if (userId) {
        const viewExists = await executeQuery(
          `SELECT 1 AS ex FROM kb_article_views WHERE article_id=@aid AND user_id=@uid AND viewed_date=@d`,
          { aid: article.article_id, uid: userId, d: today }
        );
        if (!viewExists.recordset.length) {
          await executeQuery(
            `INSERT INTO kb_article_views (article_id, user_id, viewed_date) VALUES (@aid, @uid, @d)`,
            { aid: article.article_id, uid: userId, d: today }
          );
          await executeQuery(
            `UPDATE kb_articles SET views = views + 1 WHERE article_id = @id`,
            { id: article.article_id }
          );
          article.views += 1;
        }
      }
    } catch (_) { /* view tracking failure should not break article load */ }

    // Related articles in same category
    const related = await executeQuery(`
      SELECT TOP 4 article_id, title, slug, description, icon, read_time, views
      FROM kb_articles
      WHERE category_id = @cid AND status = 'published' AND article_id != @id
      ORDER BY views DESC
    `, { cid: article.category_id, id: article.article_id });

    article.related = related.recordset;
    return res.json(createResponse(true, 'Article fetched', article));
  } catch (e) {
    logger.error('getArticleBySlug error', { error: e.message });
    return res.status(500).json(createResponse(false, 'Failed to fetch article'));
  }
};

const createArticle = async (req, res) => {
  try {
    const { category_id, title, description, content, icon, tags, difficulty, read_time, status } = req.body;
    if (!category_id || !title) return res.status(400).json(createResponse(false, 'category_id and title required'));

    let slug = slugify(title);
    // ensure unique slug
    const existing = await executeQuery(`SELECT 1 FROM kb_articles WHERE slug = @s`, { s: slug });
    if (existing.recordset.length) slug = `${slug}-${Date.now()}`;

    const pub = status === 'published' ? new Date().toISOString() : null;
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || null);
    await executeQuery(`
      INSERT INTO kb_articles
        (category_id, title, slug, description, content, icon, tags, difficulty, read_time, status, created_by, published_at)
      VALUES
        (@cid, @title, @slug, @desc, @content, @icon, @tags, @diff, @rt, @status, @uid, @pub)
    `, {
      cid: category_id, title, slug, desc: description || null, content: content || '',
      icon: icon || null, tags: tagsStr, diff: difficulty || 'Beginner',
      rt: read_time || '3 min read', status: status || 'draft', uid: req.user.user_id, pub
    });

    return res.status(201).json(createResponse(true, 'Article created'));
  } catch (e) {
    logger.error('createArticle error', { error: e.message });
    return res.status(500).json(createResponse(false, e.message));
  }
};

const updateArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, title, description, content, icon, tags, difficulty, read_time, status } = req.body;

    let slugUpdate = '';
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || null);
    const params = {
      cid: category_id || null, desc: description || null, content: content || null,
      icon: icon || null, tags: tagsStr, diff: difficulty || null,
      rt: read_time || null, status: status || null, uid: req.user.user_id, id: parseInt(id)
    };

    if (title) {
      let slug = slugify(title);
      const ex = await executeQuery(`SELECT 1 FROM kb_articles WHERE slug=@s AND article_id!=@id`, { s: slug, id: parseInt(id) });
      if (ex.recordset.length) slug = `${slug}-${Date.now()}`;
      params.title = title;
      params.slug = slug;
      slugUpdate = ', title=@title, slug=@slug';
    }

    const pubUpdate = status === 'published'
      ? `, published_at = CASE WHEN published_at IS NULL THEN GETUTCDATE() ELSE published_at END`
      : '';

    await executeQuery(`
      UPDATE kb_articles SET
        category_id = COALESCE(@cid, category_id),
        description = COALESCE(@desc, description),
        content     = COALESCE(@content, content),
        icon        = COALESCE(@icon, icon),
        tags        = COALESCE(@tags, tags),
        difficulty  = COALESCE(@diff, difficulty),
        read_time   = COALESCE(@rt, read_time),
        status      = COALESCE(@status, status),
        updated_by  = @uid,
        updated_at  = GETUTCDATE()
        ${slugUpdate}
        ${pubUpdate}
      WHERE article_id = @id
    `, params);

    return res.json(createResponse(true, 'Article updated'));
  } catch (e) {
    logger.error('updateArticle error', { error: e.message });
    return res.status(500).json(createResponse(false, e.message));
  }
};

const archiveArticle = async (req, res) => {
  try {
    const { id } = req.params;
    await executeQuery(
      `UPDATE kb_articles SET status='archived', updated_at=GETUTCDATE() WHERE article_id=@id`,
      { id: parseInt(id) }
    );
    return res.json(createResponse(true, 'Article archived'));
  } catch (e) {
    return res.status(500).json(createResponse(false, e.message));
  }
};

const publishArticle = async (req, res) => {
  try {
    const { id } = req.params;
    await executeQuery(
      `UPDATE kb_articles SET status='published', published_at=COALESCE(published_at, GETUTCDATE()), updated_at=GETUTCDATE() WHERE article_id=@id`,
      { id: parseInt(id) }
    );
    return res.json(createResponse(true, 'Article published'));
  } catch (e) {
    return res.status(500).json(createResponse(false, e.message));
  }
};

// ─────────────────────────────────────────────────────────────
//  FEEDBACK
// ─────────────────────────────────────────────────────────────

const submitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_helpful } = req.body;
    const userId = req.user.user_id;

    // Try insert; if duplicate update
    try {
      await executeQuery(
        `INSERT INTO kb_feedback (article_id, user_id, is_helpful) VALUES (@id, @uid, @helpful)`,
        { id: parseInt(id), uid: userId, helpful: is_helpful ? 1 : 0 }
      );
    } catch (dupErr) {
      if (dupErr.message.includes('UQ_kb_feedback') || dupErr.message.includes('duplicate')) {
        await executeQuery(
          `UPDATE kb_feedback SET is_helpful=@helpful WHERE article_id=@id AND user_id=@uid`,
          { id: parseInt(id), uid: userId, helpful: is_helpful ? 1 : 0 }
        );
      } else throw dupErr;
    }

    // Recount and update article totals
    const counts = await executeQuery(`
      SELECT
        SUM(CASE WHEN is_helpful=1 THEN 1 ELSE 0 END) AS yes_count,
        SUM(CASE WHEN is_helpful=0 THEN 1 ELSE 0 END) AS no_count
      FROM kb_feedback WHERE article_id=@id
    `, { id: parseInt(id) });

    const { yes_count, no_count } = counts.recordset[0];
    await executeQuery(
      `UPDATE kb_articles SET helpful_yes=@yes, helpful_no=@no WHERE article_id=@id`,
      { yes: yes_count || 0, no: no_count || 0, id: parseInt(id) }
    );

    return res.json(createResponse(true, 'Feedback saved', { helpful_yes: yes_count, helpful_no: no_count }));
  } catch (e) {
    logger.error('submitFeedback error', { error: e.message });
    return res.status(500).json(createResponse(false, e.message));
  }
};

// ─────────────────────────────────────────────────────────────
//  FAQs
// ─────────────────────────────────────────────────────────────

const getFaqs = async (req, res) => {
  try {
    const { category_id } = req.query;
    let where = `WHERE f.is_active = 1`;
    const params = {};
    if (category_id) { where += ` AND f.category_id = @cid`; params.cid = parseInt(category_id); }

    const result = await executeQuery(`
      SELECT f.faq_id, f.question, f.answer, f.sort_order, f.views,
             c.name AS category_name, c.slug AS category_slug
      FROM kb_faqs f
      LEFT JOIN kb_categories c ON f.category_id = c.category_id
      ${where}
      ORDER BY f.sort_order, f.faq_id
    `, params);

    return res.json(createResponse(true, 'FAQs fetched', result.recordset));
  } catch (e) {
    logger.error('getFaqs error', { error: e.message });
    return res.status(500).json(createResponse(false, 'Failed to fetch FAQs'));
  }
};

const createFaq = async (req, res) => {
  try {
    const { question, answer, category_id, sort_order } = req.body;
    if (!question || !answer) return res.status(400).json(createResponse(false, 'question and answer required'));
    await executeQuery(
      `INSERT INTO kb_faqs (question, answer, category_id, sort_order, created_by)
       VALUES (@q, @a, @cid, @sort, @uid)`,
      { q: question, a: answer, cid: category_id || null, sort: sort_order || 0, uid: req.user.user_id }
    );
    return res.status(201).json(createResponse(true, 'FAQ created'));
  } catch (e) {
    return res.status(500).json(createResponse(false, e.message));
  }
};

const updateFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, category_id, sort_order, is_active } = req.body;
    await executeQuery(`
      UPDATE kb_faqs SET
        question    = COALESCE(@q, question),
        answer      = COALESCE(@a, answer),
        category_id = COALESCE(@cid, category_id),
        sort_order  = COALESCE(@sort, sort_order),
        is_active   = COALESCE(@active, is_active),
        updated_at  = GETUTCDATE()
      WHERE faq_id = @id
    `, { q: question || null, a: answer || null, cid: category_id || null, sort: sort_order ?? null, active: is_active ?? null, id: parseInt(id) });
    return res.json(createResponse(true, 'FAQ updated'));
  } catch (e) {
    return res.status(500).json(createResponse(false, e.message));
  }
};

const deleteFaq = async (req, res) => {
  try {
    await executeQuery(`DELETE FROM kb_faqs WHERE faq_id=@id`, { id: parseInt(req.params.id) });
    return res.json(createResponse(true, 'FAQ deleted'));
  } catch (e) {
    return res.status(500).json(createResponse(false, e.message));
  }
};

// ─────────────────────────────────────────────────────────────
//  SEARCH
// ─────────────────────────────────────────────────────────────

const searchKB = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json(createResponse(true, 'Query too short', { articles: [], faqs: [] }));
    }

    const term = `%${q.trim()}%`;
    const [artResult, faqResult] = await Promise.all([
      executeQuery(`
        SELECT TOP 10
          a.article_id, a.title, a.slug, a.description, a.icon, a.read_time,
          a.views, a.difficulty, c.name AS category_name, c.slug AS category_slug
        FROM kb_articles a
        JOIN kb_categories c ON a.category_id = c.category_id
        WHERE a.status = 'published'
          AND (a.title LIKE @q OR a.description LIKE @q OR a.tags LIKE @q OR a.content LIKE @q)
        ORDER BY
          CASE WHEN a.title LIKE @q THEN 0 ELSE 1 END,
          a.views DESC
      `, { q: term }),
      executeQuery(`
        SELECT TOP 5 faq_id, question, answer
        FROM kb_faqs
        WHERE is_active = 1 AND (question LIKE @q OR answer LIKE @q)
        ORDER BY sort_order
      `, { q: term })
    ]);

    const totalResults = artResult.recordset.length + faqResult.recordset.length;

    // Log search (non-blocking)
    try {
      await executeQuery(
        `INSERT INTO kb_search_logs (query, result_count, user_id) VALUES (@q, @cnt, @uid)`,
        { q: q.trim().substring(0, 300), cnt: totalResults, uid: req.user?.user_id || null }
      );
    } catch (_) {}

    return res.json(createResponse(true, 'Search results', {
      articles: artResult.recordset,
      faqs: faqResult.recordset,
      total: totalResults
    }));
  } catch (e) {
    logger.error('searchKB error', { error: e.message });
    return res.status(500).json(createResponse(false, 'Search failed'));
  }
};

// ─────────────────────────────────────────────────────────────
//  POPULAR / TRENDING
// ─────────────────────────────────────────────────────────────

const getPopularArticles = async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT TOP 6
        a.article_id, a.title, a.slug, a.description, a.icon, a.read_time,
        a.views, a.helpful_yes, a.helpful_no, a.difficulty,
        c.name AS category_name, c.slug AS category_slug
      FROM kb_articles a
      JOIN kb_categories c ON a.category_id = c.category_id
      WHERE a.status = 'published'
      ORDER BY a.views DESC, a.helpful_yes DESC
    `);
    return res.json(createResponse(true, 'Popular articles', result.recordset));
  } catch (e) {
    return res.status(500).json(createResponse(false, 'Failed'));
  }
};

const getPopularSearches = async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT TOP 8 query, COUNT(*) AS search_count
      FROM kb_search_logs
      WHERE searched_at >= DATEADD(day, -30, GETUTCDATE())
      GROUP BY query
      ORDER BY search_count DESC
    `);
    return res.json(createResponse(true, 'Popular searches', result.recordset.map(r => r.query)));
  } catch (e) {
    return res.status(500).json(createResponse(false, 'Failed'));
  }
};

// ─────────────────────────────────────────────────────────────
//  ANNOUNCEMENTS
// ─────────────────────────────────────────────────────────────

const getAnnouncements = async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT announcement_id, title, body, type, starts_at, ends_at, created_at
      FROM system_announcements
      WHERE is_active = 1
        AND (starts_at IS NULL OR starts_at <= GETUTCDATE())
        AND (ends_at   IS NULL OR ends_at   >= GETUTCDATE())
      ORDER BY created_at DESC
    `);
    return res.json(createResponse(true, 'Announcements', result.recordset));
  } catch (e) {
    return res.status(500).json(createResponse(false, 'Failed'));
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const { title, body, type, starts_at, ends_at } = req.body;
    if (!title) return res.status(400).json(createResponse(false, 'title required'));
    // datetime-local sends "YYYY-MM-DDTHH:mm" — replace T with space for SQL Server
    const toSqlDt = (v) => v ? v.replace('T', ' ').trim() : null;
    await executeQuery(`
      INSERT INTO system_announcements (title, body, type, starts_at, ends_at, created_by)
      VALUES (@title, @body, @type, @starts, @ends, @uid)
    `, {
      title, body: body || null, type: type || 'info',
      starts: toSqlDt(starts_at), ends: toSqlDt(ends_at), uid: req.user.user_id
    });
    return res.status(201).json(createResponse(true, 'Announcement created'));
  } catch (e) {
    return res.status(500).json(createResponse(false, e.message));
  }
};

const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, type, is_active, starts_at, ends_at } = req.body;
    const toSqlDt = (v) => v ? v.replace('T', ' ').trim() : null;
    await executeQuery(`
      UPDATE system_announcements SET
        title      = COALESCE(@title, title),
        body       = COALESCE(@body, body),
        type       = COALESCE(@type, type),
        is_active  = COALESCE(@active, is_active),
        starts_at  = COALESCE(@starts, starts_at),
        ends_at    = COALESCE(@ends, ends_at),
        updated_at = GETUTCDATE()
      WHERE announcement_id = @id
    `, { title: title || null, body: body || null, type: type || null, active: is_active ?? null,
         starts: toSqlDt(starts_at), ends: toSqlDt(ends_at), id: parseInt(id) });
    return res.json(createResponse(true, 'Announcement updated'));
  } catch (e) {
    return res.status(500).json(createResponse(false, e.message));
  }
};

const getAdminAnnouncements = async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT announcement_id, title, body, type, is_active, starts_at, ends_at, created_at
      FROM system_announcements
      ORDER BY created_at DESC
    `);
    return res.json(createResponse(true, 'All announcements', result.recordset));
  } catch (e) {
    return res.status(500).json(createResponse(false, 'Failed'));
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    await executeQuery(
      `DELETE FROM system_announcements WHERE announcement_id = @id`,
      { id: parseInt(id) }
    );
    return res.json(createResponse(true, 'Announcement deleted'));
  } catch (e) {
    return res.status(500).json(createResponse(false, e.message));
  }
};

// ─────────────────────────────────────────────────────────────
//  ADMIN ANALYTICS
// ─────────────────────────────────────────────────────────────

const getKbAnalytics = async (req, res) => {
  try {
    const [summary, topArticles, noResults] = await Promise.all([
      executeQuery(`
        SELECT
          (SELECT COUNT(*) FROM kb_articles WHERE status='published') AS published_articles,
          (SELECT COUNT(*) FROM kb_articles WHERE status='draft')     AS draft_articles,
          (SELECT ISNULL(SUM(views),0) FROM kb_articles)              AS total_views,
          (SELECT COUNT(*) FROM kb_search_logs WHERE searched_at >= DATEADD(day,-30,GETUTCDATE())) AS searches_30d,
          (SELECT COUNT(*) FROM kb_search_logs WHERE result_count=0 AND searched_at >= DATEADD(day,-30,GETUTCDATE())) AS no_result_30d
      `),
      executeQuery(`
        SELECT TOP 10 a.title, a.slug, a.views, a.helpful_yes, a.helpful_no,
          CASE WHEN (a.helpful_yes + a.helpful_no)>0
               THEN CAST(a.helpful_yes*100/(a.helpful_yes+a.helpful_no) AS INT)
               ELSE NULL END AS helpful_pct
        FROM kb_articles a
        WHERE a.status='published'
        ORDER BY a.views DESC
      `),
      executeQuery(`
        SELECT TOP 10 query, COUNT(*) AS cnt
        FROM kb_search_logs
        WHERE result_count=0 AND searched_at >= DATEADD(day,-30,GETUTCDATE())
        GROUP BY query
        ORDER BY cnt DESC
      `)
    ]);

    return res.json(createResponse(true, 'KB analytics', {
      summary: summary.recordset[0],
      top_articles: topArticles.recordset,
      no_result_searches: noResults.recordset
    }));
  } catch (e) {
    logger.error('getKbAnalytics error', { error: e.message });
    return res.status(500).json(createResponse(false, 'Failed'));
  }
};

// ─────────────────────────────────────────────────────────────
//  ADMIN: ALL ARTICLES (including drafts)
// ─────────────────────────────────────────────────────────────

const getAdminArticles = async (req, res) => {
  try {
    const { status, category_id } = req.query;
    let where = `WHERE 1=1`;
    const params = {};
    if (status) { where += ` AND a.status=@status`; params.status = status; }
    if (category_id) { where += ` AND a.category_id=@cid`; params.cid = parseInt(category_id); }

    const result = await executeQuery(`
      SELECT
        a.article_id, a.title, a.slug, a.status, a.views, a.helpful_yes, a.helpful_no,
        a.difficulty, a.read_time, a.published_at, a.updated_at, a.tags, a.icon,
        a.description, a.content, a.category_id,
        c.name AS category_name,
        u.first_name + ' ' + u.last_name AS author_name,
        CASE WHEN (a.helpful_yes+a.helpful_no)>0
             THEN CAST(a.helpful_yes*100/(a.helpful_yes+a.helpful_no) AS INT)
             ELSE NULL END AS helpful_pct
      FROM kb_articles a
      JOIN kb_categories c ON a.category_id = c.category_id
      JOIN users u ON a.created_by = u.user_id
      ${where}
      ORDER BY a.updated_at DESC
    `, params);
    return res.json(createResponse(true, 'Admin articles', result.recordset));
  } catch (e) {
    return res.status(500).json(createResponse(false, e.message));
  }
};

module.exports = {
  // categories
  getCategories, createCategory, updateCategory,
  // articles (public)
  getArticles, getArticleBySlug,
  // articles (admin)
  createArticle, updateArticle, archiveArticle, publishArticle,
  getAdminArticles,
  // feedback
  submitFeedback,
  // faqs
  getFaqs, createFaq, updateFaq, deleteFaq,
  // search
  searchKB,
  // popular
  getPopularArticles, getPopularSearches,
  // announcements
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, getAdminAnnouncements,
  // analytics
  getKbAnalytics,
};
