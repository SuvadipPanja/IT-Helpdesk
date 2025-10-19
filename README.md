# 💼 IT Helpdesk System

![GitHub repo size](https://img.shields.io/github/repo-size/SuvadipPanja/IT-Helpdesk?color=blue)
![GitHub last commit](https://img.shields.io/github/last-commit/SuvadipPanja/IT-Helpdesk)
![GitHub license](https://img.shields.io/badge/license-MIT-green)
![GitHub issues](https://img.shields.io/github/issues/SuvadipPanja/IT-Helpdesk)

A full-stack **IT Helpdesk Management System** built using **Node.js, Express, React, and SQL Server**.  
Designed for organizations to handle IT support tickets efficiently with role-based access, notifications, analytics, and an interactive web UI.

---

## 🚀 Features

### 👨‍💻 Core Helpdesk
- Ticket creation, assignment, update, and closure workflow  
- Role-based access (Admin, Engineer, Team Lead, Senior Team Lead)  
- Real-time dashboard and statistics  

### ⚙️ Automation & Management
- Deadline tracking and escalation logic  
- Automatic reassignment of overdue tickets  
- Email queueing and notifications  
- Department and user management  

### 🧠 Analytics & Insights
- Downloadable ticket reports and analytics dashboard  
- Call tracking and resolution metrics  
- Activity logs and trend analysis  

### 🌐 Additional
- Multilingual UI (English + Hindi/Bengali support)  
- Mobile-responsive frontend (React + Vite)  
- Secure authentication (JWT + bcrypt)  

---

## 🏗️ Project Structure

it-helpdesk/
│
├── backend/ # Node.js + Express + SQL Server backend
│ ├── config/ # Configuration and database connection
│ ├── controllers/ # Business logic controllers
│ ├── middleware/ # Authentication, logging, error handling
│ ├── models/ # DB access (MSSQL)
│ ├── routes/ # API routes
│ ├── services/ # Email, queue, and helper services
│ ├── uploads/ # Uploaded files and profile images
│ ├── utils/ # Logger and helper functions
│ └── server.js # App entry point
│
├── frontend/ # React + Vite frontend
│ ├── src/ # Components, pages, styles, and assets
│ ├── public/ # Public static assets
│ └── package.json # Frontend dependencies
│
├── Backup/ # Backup and logs folder (ignored by Git)
├── .gitignore
└── README.md

yaml
Copy code

---

## ⚙️ Installation & Setup

### 🖥️ 1. Clone Repository
```bash
git clone https://github.com/SuvadipPanja/IT-Helpdesk.git
cd IT-Helpdesk
🧩 2. Backend Setup
bash
Copy code
cd backend
npm install
Create .env file (refer .env.example):
env
Copy code
PORT=5000
DB_HOST=localhost
DB_USER=sa
DB_PASSWORD=yourpassword
DB_NAME=ProjectX

EMAIL_ENABLED=true
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_app_password
Start the backend server:
bash
Copy code
npm start
The backend will start at ➜ http://localhost:5000

💻 3. Frontend Setup
bash
Copy code
cd ../frontend
npm install
npm run dev
The frontend will start at ➜ http://localhost:5173

🧠 Environment Variables
Variable	Description
PORT	Backend server port
DB_HOST, DB_USER, DB_PASSWORD, DB_NAME	SQL Server credentials
EMAIL_ENABLED	Enable/disable email notifications
SMTP_SERVER, SMTP_PORT, SMTP_USER, SMTP_PASS	SMTP configuration
JWT_SECRET	Token secret (optional for auth)

📊 Tech Stack
Frontend: React, Vite, Axios, CSS
Backend: Node.js, Express, JWT, Bcrypt
Database: Microsoft SQL Server
Libraries: Nodemailer, Winston Logger, CORS, Multer
Other Tools: Apache Tomcat (for deployment), Docker (optional), Postman (API Testing)

📸 Screenshots
(Add screenshots in docs/screenshots/ and link them here)

Login Page	Dashboard	Ticket Details

🧰 Useful Commands
Command	Description
git status	Check modified files
git add .	Stage all changes
git commit -m "message"	Commit staged changes
git push	Push to GitHub
npm start	Run backend
npm run dev	Run frontend

📅 Roadmap
 Backend API (Node.js + SQL Server)

 React frontend with authentication

 Role-based ticket system

 Add CI/CD with GitHub Actions

 Add Docker Compose deployment

 Mobile app version (React Native)

👨‍💻 Contributors
Name	Role
Suvadip Panja	Project Owner & Full-Stack Developer

📜 License
This project is licensed under the MIT License.
You are free to use, modify, and distribute this software.

⭐ Support
If you find this project helpful, please star ⭐ the repository on GitHub!
For feedback or collaboration, connect via LinkedIn or raise an Issue in the repo.

