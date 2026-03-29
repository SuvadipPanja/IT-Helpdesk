const ticketService = require('./ticketService');
const logger = require('../utils/logger');

class BotIntentHandler {
  /**
   * Parse ticket creation intent from natural language
   * Extracts: subject, priority, category, description
   */
  parseTicketCreationIntent(message, user) {
    try {
      // Extract potential priority
      let priority = 'Medium';
      if (/critical|urgent|asap|immediately|emergency/i.test(message)) priority = 'Critical';
      else if (/high|important|soon|quickly/i.test(message)) priority = 'High';
      else if (/low|whenever|whenever possible|when you have time|not urgent/i.test(message)) priority = 'Low';

      // Extract potential category
      let category = 'General';
      if (/email|mail|outlook|gmail/i.test(message)) category = 'Email';
      else if (/password|login|authentication|access|credential/i.test(message)) category = 'Account Access';
      else if (/network|internet|wifi|connection|connectivity/i.test(message)) category = 'Network';
      else if (/printer|scanner|device|laptop|computer|hardware/i.test(message)) category = 'Equipment';
      else if (/mobile|phone|android|iphone/i.test(message)) category = 'Mobile';

      return {
        intent: 'CREATE_TICKET',
        confidence: 0.85,
        extracted: {
          priority,
          category,
          raw_message: message,
          user_role: user.role_code
        },
        next_step: 'confirm_department'
      };
    } catch (error) {
      logger.error('Error parsing ticket creation intent:', error);
      throw error;
    }
  }

  parseCreateTicketIntent(message, user) {
    return this.parseTicketCreationIntent(message, user);
  }

  /**
   * Parse ticket view intent
   * Extracts: ticket_id/ticket_number if mentioned
   */
  parseTicketViewIntent(message, user) {
    // Extract ticket number: TKT-2026-00001 or just #123 or "ticket 123"
    const ticketMatch = message.match(/(?:TKT-\d{4}-\d{5}|#?\d{4,}|ticket\s+(?:number\s+)?(\d+))/i);
    const ticketId = ticketMatch ? ticketMatch[1] || ticketMatch[0] : null;

    const hasViewPattern = /show|list|view|what.*tickets?/i.test(message);

    return {
      intent: 'VIEW_TICKETS',
      confidence: ticketId ? 0.95 : (hasViewPattern ? 0.9 : 0.75),
      extracted: {
        ticket_id: ticketId,
        filter_type: 'my_tickets'
      },
      next_step: 'execute'
    };
  }

  /**
   * Parse ticket update intent
   */
  parseTicketUpdateIntent(message, user) {
    const ticketMatch = message.match(/(?:TKT-\d{4}-\d{5}|#?\d{4,})/);
    const statusMatch = message.match(/(close|reopen|in progress|resolved|pending|open)/i);

    return {
      intent: 'UPDATE_TICKET',
      confidence: statusMatch ? 0.85 : 0.6,
      extracted: {
        ticket_id: ticketMatch ? ticketMatch[0] : null,
        new_status: statusMatch ? statusMatch[1] : null
      },
      next_step: statusMatch ? 'execute' : 'confirm'
    };
  }

  /**
   * Parse ticket search intent
   */
  parseTicketSearchIntent(message, user) {
    // Extract search keywords (everything except common words)
    const keywordsText = message
      .replace(/(?:find|search|look|show|get|query|ticket|about|for)/gi, '')
      .trim();

    const keywords = keywordsText
      .split(/\s+/)
      .filter((word) => word && word.length > 1);

    return {
      intent: 'SEARCH_TICKETS',
      confidence: 0.8,
      extracted: {
        query: keywordsText,
        keywords,
        user_id: user.user_id
      },
      next_step: 'execute'
    };
  }

  /**
   * Parse team statistics intent
   */
  parseTeamStatsIntent(message, user) {
    return {
      intent: 'TEAM_STATS',
      confidence: 0.95,
      extracted: {
        user_id: user.user_id
      },
      next_step: 'execute'
    };
  }

  /**
   * Execute intent by calling appropriate service
   */
  async executeIntent(intent, data, user) {
    try {
      switch (intent.intent) {
        case 'CREATE_TICKET':
          return await this.handleCreateTicket(data, user);
        case 'VIEW_TICKETS':
          return await this.handleViewTickets(data, user);
        case 'UPDATE_TICKET':
          return await this.handleUpdateTicket(data, user);
        case 'SEARCH_TICKETS':
          return await this.handleSearchTickets(data, user);
        case 'TEAM_STATS':
          return await this.handleTeamStats(data, user);
        default:
          throw new Error(`Unknown intent: ${intent.intent}`);
      }
    } catch (error) {
      logger.error('Error executing intent:', error);
      throw error;
    }
  }

  async handleCreateTicket(data, user) {
    try {
      const ticket = await ticketService.createTicketFromBot({
        subject: data.subject,
        description: data.description,
        priority_id: data.priority_id,
        category_id: data.category_id,
        department_id: data.department_id,
        requester_id: user.user_id
      }, user.user_id);

      return {
        success: true,
        intent: 'CREATE_TICKET',
        ticket_number: ticket.ticket_number,
        ticket_id: ticket.ticket_id,
        message: `✅ Ticket ${ticket.ticket_number} created successfully!`,
        followUp: ['View ticket details', 'Create another ticket', 'Check my tickets']
      };
    } catch (error) {
      logger.error('Error creating ticket:', error);
      return { success: false, intent: 'CREATE_TICKET', error: error.message, message: `❌ Error: ${error.message}` };
    }
  }

  async handleViewTickets(data, user) {
    try {
      let tickets = [];
      
      if (data.ticket_id) {
        // Get single ticket
        const ticket = await ticketService.getTicketById(data.ticket_id, user.user_id);
        tickets = [ticket];
      } else {
        // Get all user's tickets
        tickets = await ticketService.getMyTickets(user.user_id, {});
      }
      
      return {
        success: true,
        intent: 'VIEW_TICKETS',
        tickets: tickets,
        count: tickets.length,
        message: `📋 You have ${tickets.length} ticket(s)`,
        followUp: ['View ticket details', 'Search tickets', 'Create new ticket']
      };
    } catch (error) {
      logger.error('Error viewing tickets:', error);
      return { success: false, intent: 'VIEW_TICKETS', error: error.message };
    }
  }

  async handleUpdateTicket(data, user) {
    try {
      if (!data.ticket_id || !data.new_status) {
        throw new Error('Missing ticket ID or status');
      }

      await ticketService.updateTicketStatus(data.ticket_id, data.new_status, user.user_id);
      
      return {
        success: true,
        intent: 'UPDATE_TICKET',
        message: `✅ Ticket updated to "${data.new_status}"`,
        followUp: ['View updated ticket', 'Create another ticket', 'View my tickets']
      };
    } catch (error) {
      logger.error('Error updating ticket:', error);
      return { success: false, intent: 'UPDATE_TICKET', error: error.message };
    }
  }

  async handleSearchTickets(data, user) {
    try {
      const results = await ticketService.searchTickets(data.query, user.user_id);
      
      return {
        success: true,
        intent: 'SEARCH_TICKETS',
        results: results,
        count: results.length,
        message: `🔍 Found ${results.length} matching ticket(s)`,
        followUp: ['View details', 'Create ticket', 'Show all tickets']
      };
    } catch (error) {
      logger.error('Error searching tickets:', error);
      return { success: false, intent: 'SEARCH_TICKETS', error: error.message };
    }
  }

  async handleTeamStats(data, user) {
    try {
      const stats = await ticketService.getTeamTicketStats(user.user_id);
      
      return {
        success: true,
        intent: 'TEAM_STATS',
        stats: stats,
        message: `📊 Team Ticket Statistics:\n• Total: ${stats.total_tickets}\n• Open: ${stats.open_tickets}\n• Closed: ${stats.closed_tickets}\n• Critical Open: ${stats.critical_open}`,
        followUp: ['View my tickets', 'Create ticket', 'Search tickets']
      };
    } catch (error) {
      logger.error('Error getting team stats:', error);
      return { success: false, intent: 'TEAM_STATS', error: error.message };
    }
  }

  /**
   * Build natural language response from execution result
   */
  buildIntentResponse(result, user) {
    if (!result.success) {
      return {
        text: `❌ I couldn't complete that action. Error: ${result.error || 'Unknown error'}`,
        type: 'error',
        followUp: ['Try again', 'Get help', 'Talk to support']
      };
    }

    switch (result.intent) {
      case 'CREATE_TICKET':
        return {
          text: `✅ Your ticket **${result.ticket_number}** has been created successfully!\n\nWhat would you like to do next?`,
          type: 'success',
          ticket_id: result.ticket_id,
          followUp: result.followUp
        };
      case 'VIEW_TICKETS':
        const ticketList = result.tickets.slice(0, 5).map(t => 
          `• **${t.ticket_number}**: ${t.subject} - ${t.status_name}`
        ).join('\n');
        return {
          text: `📋 Your Tickets (${result.count} total):\n\n${ticketList}${result.count > 5 ? '\n... and more' : ''}`,
          type: 'info',
          followUp: result.followUp
        };
      case 'SEARCH_TICKETS':
        const searchList = result.results.slice(0, 5).map(t =>
          `• **${t.ticket_number}**: ${t.subject}`
        ).join('\n');
        return {
          text: `🔍 Search Results (${result.count} found):\n\n${searchList}`,
          type: 'info',
          followUp: result.followUp
        };
      case 'TEAM_STATS':
        return {
          text: result.message,
          type: 'info',
          followUp: result.followUp
        };
      default:
        return { text: result.message, type: 'info', followUp: result.followUp };
    }
  }
}

module.exports = new BotIntentHandler();
