markdown# IT Helpdesk API - Complete Testing Guide

## 📋 Table of Contents
1. [Base Configuration](#base-configuration)
2. [Authentication Endpoints](#authentication-endpoints)
3. [System/Lookup Endpoints](#systemlookup-endpoints)
4. [User Management Endpoints](#user-management-endpoints)
5. [Ticket Management Endpoints](#ticket-management-endpoints)
6. [Error Responses](#error-responses)
7. [Testing Tips](#testing-tips)

---

## Base Configuration

### Base URL
http://localhost:5000/api/v1

### Authentication
All endpoints except login require a Bearer token in the Authorization header:
Authorization: Bearer YOUR_JWT_TOKEN_HERE

### Content Type
For POST and PUT requests:
Content-Type: application/json

### Default Credentials
Username: admin
Password: Admin@123
Email: admin@ithelpdesk.com

---

## Authentication Endpoints

### 1.1 User Login
**POST** `/auth/login`

**Description:** Authenticate user and receive JWT token

**Request Body:**
```json
{
  "username": "admin",
  "password": "Admin@123"
}
Success Response (200):
json{
  "success": true,
  "message": "Login successful",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImFkbWluIiwiZW1haWwiOiJhZG1pbkBpdGhlbHBkZXNrLmNvbSIsInJvbGVfY29kZSI6IkFETUlOIiwiaWF0IjoxNzYwMjA1MDMzLCJleHAiOjE3NjAyMzM4MzMsImF1ZCI6IklUSGVscGRlc2stVXNlcnMiLCJpc3MiOiJJVEhlbHBkZXNrIn0.1TaxC_fAczvuUCfgkeFUdGkcO5l0xoK0nkEFZpNyoaM",
    "user": {
      "user_id": 1,
      "username": "admin",
      "email": "admin@ithelpdesk.com",
      "first_name": "System",
      "last_name": "Administrator",
      "full_name": "System Administrator",
      "role": {
        "role_id": 1,
        "role_name": "Administrator",
        "role_code": "ADMIN"
      },
      "department": {
        "department_id": 1,
        "department_name": "Information Technology"
      },
      "permissions": {
        "can_create_tickets": true,
        "can_view_all_tickets": true,
        "can_assign_tickets": true,
        "can_close_tickets": true,
        "can_delete_tickets": true,
        "can_manage_users": true,
        "can_manage_departments": true,
        "can_manage_roles": true,
        "can_view_analytics": true,
        "can_manage_system": true
      }
    }
  }
}
Error Response (401):
json{
  "success": false,
  "message": "Invalid username or password",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
cURL Command:
bashcurl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
Windows PowerShell:
powershellInvoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/login" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"username":"admin","password":"Admin@123"}'

1.2 Get Current User Profile
GET /auth/me
Description: Get authenticated user's profile information
Headers:
Authorization: Bearer YOUR_TOKEN
Success Response (200):
json{
  "success": true,
  "message": "User profile fetched successfully",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "data": {
    "user_id": 1,
    "username": "admin",
    "email": "admin@ithelpdesk.com",
    "first_name": "System",
    "last_name": "Administrator",
    "full_name": "System Administrator",
    "phone_number": "+1-555-0100",
    "profile_picture": null,
    "last_login": "2025-10-11T23:20:33.260Z",
    "created_at": "2025-10-11T20:07:36.903Z",
    "role": {
      "role_id": 1,
      "role_name": "Administrator",
      "role_code": "ADMIN"
    },
    "department": {
      "department_id": 1,
      "department_name": "Information Technology",
      "department_code": "IT"
    },
    "permissions": {
      "can_create_tickets": true,
      "can_view_all_tickets": true,
      "can_assign_tickets": true,
      "can_close_tickets": true,
      "can_delete_tickets": true,
      "can_manage_users": true,
      "can_manage_departments": true,
      "can_manage_roles": true,
      "can_view_analytics": true,
      "can_manage_system": true
    }
  }
}
cURL Command:
bashcurl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

1.3 User Logout
POST /auth/logout
Description: Logout user and invalidate session
Headers:
Authorization: Bearer YOUR_TOKEN
Success Response (200):
json{
  "success": true,
  "message": "Logout successful",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
cURL Command:
bashcurl -X POST http://localhost:5000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN"

1.4 Change Password
PUT /auth/change-password
Description: Change user password
Headers:
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
Request Body:
json{
  "current_password": "Admin@123",
  "new_password": "NewAdmin@123"
}
Validation Rules:

New password must be at least 8 characters
Must contain at least one uppercase letter
Must contain at least one number
Must contain at least one special character

Success Response (200):
json{
  "success": true,
  "message": "Password changed successfully",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
cURL Command:
bashcurl -X PUT http://localhost:5000/api/v1/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"Admin@123","new_password":"NewAdmin@123"}'

System/Lookup Endpoints
2.1 Get All Categories
GET /system/categories
Description: Get all ticket categories (10 categories available)
Headers:
Authorization: Bearer YOUR_TOKEN
Success Response (200):
json{
  "success": true,
  "message": "Categories fetched successfully",
  "timestamp": "2025-10-11T17:54:25.671Z",
  "data": [
    {
      "category_id": 1,
      "category_name": "Hardware Issue",
      "category_code": "HARDWARE",
      "description": "Computer, printer, phone hardware problems",
      "default_priority_id": 3,
      "sla_hours": 24,
      "is_active": true,
      "display_order": 1
    },
    {
      "category_id": 2,
      "category_name": "Software Issue",
      "category_code": "SOFTWARE",
      "description": "Application errors and software problems",
      "default_priority_id": 3,
      "sla_hours": 24,
      "is_active": true,
      "display_order": 2
    },
    {
      "category_id": 3,
      "category_name": "Network Issue",
      "category_code": "NETWORK",
      "description": "Internet, WiFi, VPN connectivity issues",
      "default_priority_id": 2,
      "sla_hours": 8,
      "is_active": true,
      "display_order": 3
    },
    {
      "category_id": 4,
      "category_name": "Account Access",
      "category_code": "ACCESS",
      "description": "Password resets, account lockouts",
      "default_priority_id": 2,
      "sla_hours": 4,
      "is_active": true,
      "display_order": 4
    },
    {
      "category_id": 5,
      "category_name": "New Request",
      "category_code": "NEW_REQUEST",
      "description": "New equipment or software requests",
      "default_priority_id": 4,
      "sla_hours": 48,
      "is_active": true,
      "display_order": 5
    },
    {
      "category_id": 6,
      "category_name": "Email Issue",
      "category_code": "EMAIL",
      "description": "Email delivery, configuration problems",
      "default_priority_id": 3,
      "sla_hours": 12,
      "is_active": true,
      "display_order": 6
    },
    {
      "category_id": 7,
      "category_name": "Security Issue",
      "category_code": "SECURITY",
      "description": "Security incidents and threats",
      "default_priority_id": 1,
      "sla_hours": 2,
      "is_active": true,
      "display_order": 7
    },
    {
      "category_id": 8,
      "category_name": "Performance Issue",
      "category_code": "PERFORMANCE",
      "description": "Slow system or application performance",
      "default_priority_id": 3,
      "sla_hours": 24,
      "is_active": true,
      "display_order": 8
    },
    {
      "category_id": 9,
      "category_name": "Training Request",
      "category_code": "TRAINING",
      "description": "Software or system training needed",
      "default_priority_id": 5,
      "sla_hours": 168,
      "is_active": true,
      "display_order": 9
    },
    {
      "category_id": 10,
      "category_name": "Other",
      "category_code": "OTHER",
      "description": "Issues not covered by other categories",
      "default_priority_id": 3,
      "sla_hours": 24,
      "is_active": true,
      "display_order": 10
    }
  ]
}
cURL Command:
bashcurl -X GET http://localhost:5000/api/v1/system/categories \
  -H "Authorization: Bearer YOUR_TOKEN"

2.2 Get All Priorities
GET /system/priorities
Description: Get all ticket priorities (5 levels available)
Success Response (200):
json{
  "success": true,
  "message": "Priorities fetched successfully",
  "timestamp": "2025-10-11T17:54:37.836Z",
  "data": [
    {
      "priority_id": 1,
      "priority_name": "Critical",
      "priority_code": "CRITICAL",
      "priority_level": 1,
      "color_code": "#DC2626",
      "response_time_hours": 1,
      "resolution_time_hours": 4,
      "is_active": true
    },
    {
      "priority_id": 2,
      "priority_name": "High",
      "priority_code": "HIGH",
      "priority_level": 2,
      "color_code": "#EA580C",
      "response_time_hours": 2,
      "resolution_time_hours": 8,
      "is_active": true
    },
    {
      "priority_id": 3,
      "priority_name": "Medium",
      "priority_code": "MEDIUM",
      "priority_level": 3,
      "color_code": "#F59E0B",
      "response_time_hours": 4,
      "resolution_time_hours": 24,
      "is_active": true
    },
    {
      "priority_id": 4,
      "priority_name": "Low",
      "priority_code": "LOW",
      "priority_level": 4,
      "color_code": "#3B82F6",
      "response_time_hours": 8,
      "resolution_time_hours": 48,
      "is_active": true
    },
    {
      "priority_id": 5,
      "priority_name": "Planning",
      "priority_code": "PLANNING",
      "priority_level": 5,
      "color_code": "#6B7280",
      "response_time_hours": 24,
      "resolution_time_hours": 168,
      "is_active": true
    }
  ]
}
cURL Command:
bashcurl -X GET http://localhost:5000/api/v1/system/priorities \
  -H "Authorization: Bearer YOUR_TOKEN"

2.3 Get All Statuses
GET /system/statuses
Description: Get all ticket statuses (7 statuses available)
Success Response (200):
json{
  "success": true,
  "message": "Statuses fetched successfully",
  "timestamp": "2025-10-11T17:54:47.740Z",
  "data": [
    {
      "status_id": 1,
      "status_name": "Open",
      "status_code": "OPEN",
      "status_type": "OPEN",
      "color_code": "#3B82F6",
      "is_active": true,
      "is_final_status": false,
      "display_order": 1
    },
    {
      "status_id": 2,
      "status_name": "In Progress",
      "status_code": "IN_PROGRESS",
      "status_type": "IN_PROGRESS",
      "color_code": "#F59E0B",
      "is_active": true,
      "is_final_status": false,
      "display_order": 2
    },
    {
      "status_id": 3,
      "status_name": "Pending",
      "status_code": "PENDING",
      "status_type": "IN_PROGRESS",
      "color_code": "#A855F7",
      "is_active": true,
      "is_final_status": false,
      "display_order": 3
    },
    {
      "status_id": 4,
      "status_name": "On Hold",
      "status_code": "ON_HOLD",
      "status_type": "IN_PROGRESS",
      "color_code": "#6B7280",
      "is_active": true,
      "is_final_status": false,
      "display_order": 4
    },
    {
      "status_id": 5,
      "status_name": "Resolved",
      "status_code": "RESOLVED",
      "status_type": "RESOLVED",
      "color_code": "#10B981",
      "is_active": true,
      "is_final_status": true,
      "display_order": 5
    },
    {
      "status_id": 6,
      "status_name": "Closed",
      "status_code": "CLOSED",
      "status_type": "CLOSED",
      "color_code": "#059669",
      "is_active": true,
      "is_final_status": true,
      "display_order": 6
    },
    {
      "status_id": 7,
      "status_name": "Cancelled",
      "status_code": "CANCELLED",
      "status_type": "CLOSED",
      "color_code": "#EF4444",
      "is_active": true,
      "is_final_status": true,
      "display_order": 7
    }
  ]
}
cURL Command:
bashcurl -X GET http://localhost:5000/api/v1/system/statuses \
  -H "Authorization: Bearer YOUR_TOKEN"

2.4 Get All Roles
GET /system/roles
Description: Get all user roles with permissions (4 base roles)
Success Response (200):
json{
  "success": true,
  "message": "Roles fetched successfully",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "data": [
    {
      "role_id": 1,
      "role_name": "Administrator",
      "role_code": "ADMIN",
      "description": "Full system administrator with all permissions",
      "can_create_tickets": true,
      "can_view_all_tickets": true,
      "can_assign_tickets": true,
      "can_close_tickets": true,
      "can_delete_tickets": true,
      "can_manage_users": true,
      "can_manage_departments": true,
      "can_manage_roles": true,
      "can_view_analytics": true,
      "can_manage_system": true,
      "is_active": true,
      "is_system_role": true
    },
    {
      "role_id": 2,
      "role_name": "Manager",
      "role_code": "MANAGER",
      "description": "Department manager with analytics and user management",
      "can_create_tickets": true,
      "can_view_all_tickets": true,
      "can_assign_tickets": true,
      "can_close_tickets": true,
      "can_delete_tickets": false,
      "can_manage_users": true,
      "can_manage_departments": true,
      "can_manage_roles": false,
      "can_view_analytics": true,
      "can_manage_system": false,
      "is_active": true,
      "is_system_role": true
    },
    {
      "role_id": 3,
      "role_name": "Engineer",
      "role_code": "ENGINEER",
      "description": "IT support engineer who handles tickets",
      "can_create_tickets": true,
      "can_view_all_tickets": true,
      "can_assign_tickets": true,
      "can_close_tickets": true,
      "can_delete_tickets": false,
      "can_manage_users": false,
      "can_manage_departments": false,
      "can_manage_roles": false,
      "can_view_analytics": false,
      "can_manage_system": false,
      "is_active": true,
      "is_system_role": true
    },
    {
      "role_id": 4,
      "role_name": "User",
      "role_code": "USER",
      "description": "Standard user who can create and view own tickets",
      "can_create_tickets": true,
      "can_view_all_tickets": false,
      "can_assign_tickets": false,
      "can_close_tickets": false,
      "can_delete_tickets": false,
      "can_manage_users": false,
      "can_manage_departments": false,
      "can_manage_roles": false,
      "can_view_analytics": false,
      "can_manage_system": false,
      "is_active": true,
      "is_system_role": true
    }
  ]
}
cURL Command:
bashcurl -X GET http://localhost:5000/api/v1/system/roles \
  -H "Authorization: Bearer YOUR_TOKEN"

2.5 Get All Departments
GET /system/departments
Description: Get all departments (6 departments available)
Success Response (200):
json{
  "success": true,
  "message": "Departments fetched successfully",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "data": [
    {
      "department_id": 1,
      "department_name": "Information Technology",
      "department_code": "IT",
      "description": "IT support and infrastructure team",
      "manager_id": null,
      "is_active": true,
      "manager_name": null
    },
    {
      "department_id": 2,
      "department_name": "Human Resources",
      "department_code": "HR",
      "description": "Human resources department",
      "manager_id": null,
      "is_active": true,
      "manager_name": null
    },
    {
      "department_id": 3,
      "department_name": "Finance",
      "department_code": "FIN",
      "description": "Finance and accounting department",
      "manager_id": null,
      "is_active": true,
      "manager_name": null
    },
    {
      "department_id": 4,
      "department_name": "Operations",
      "department_code": "OPS",
      "description": "Operations and logistics department",
      "manager_id": null,
      "is_active": true,
      "manager_name": null
    },
    {
      "department_id": 5,
      "department_name": "Sales",
      "department_code": "SALES",
      "description": "Sales and business development",
      "manager_id": null,
      "is_active": true,
      "manager_name": null
    },
    {
      "department_id": 6,
      "department_name": "Marketing",
      "department_code": "MKT",
      "description": "Marketing and communications",
      "manager_id": null,
      "is_active": true,
      "manager_name": null
    }
  ]
}
cURL Command:
bashcurl -X GET http://localhost:5000/api/v1/system/departments \
  -H "Authorization: Bearer YOUR_TOKEN"

2.6 Get All Engineers
GET /system/engineers
Description: Get all engineers available for ticket assignment
Success Response (200):
json{
  "success": true,
  "message": "Engineers fetched successfully",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "data": [
    {
      "user_id": 1,
      "username": "admin",
      "email": "admin@ithelpdesk.com",
      "full_name": "System Administrator",
      "role_name": "Administrator",
      "department_name": "Information Technology"
    }
  ]
}
cURL Command:
bashcurl -X GET http://localhost:5000/api/v1/system/engineers \
  -H "Authorization: Bearer YOUR_TOKEN"

2.7 Get Dashboard Statistics
GET /system/dashboard-stats
Description: Get dashboard statistics for current user
Success Response (200):
json{
  "success": true,
  "message": "Dashboard stats fetched successfully",
  "timestamp": "2025-10-11T17:54:16.235Z",
  "data": {
    "total_tickets": 0,
    "open_tickets": 0,
    "in_progress_tickets": 0,
    "resolved_tickets": 0,
    "assigned_to_me": 0,
    "created_by_me": 0,
    "critical_tickets": 0,
    "overdue_tickets": 0
  }
}
Notes:

Regular users see only their own tickets statistics
Admins/Managers see all tickets statistics

cURL Command:
bashcurl -X GET http://localhost:5000/api/v1/system/dashboard-stats \
  -H "Authorization: Bearer YOUR_TOKEN"

2.8 Get System Settings
GET /system/settings
Description: Get all system settings (Admin only)
Success Response (200):
json{
  "success": true,
  "message": "Settings fetched successfully",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "data": [
    {
      "setting_id": 1,
      "setting_key": "APP_NAME",
      "setting_value": "IT Helpdesk System",
      "setting_type": "STRING",
      "description": "Application name",
      "is_editable": true
    },
    {
      "setting_id": 2,
      "setting_key": "MAX_FILE_SIZE_MB",
      "setting_value": "10",
      "setting_type": "NUMBER",
      "description": "Maximum file upload size in MB",
      "is_editable": true
    },
    {
      "setting_id": 3,
      "setting_key": "SESSION_TIMEOUT_MINUTES",
      "setting_value": "480",
      "setting_type": "NUMBER",
      "description": "Session timeout in minutes (8 hours)",
      "is_editable": true
    }
  ]
}
cURL Command:
bashcurl -X GET http://localhost:5000/api/v1/system/settings \
  -H "Authorization: Bearer YOUR_TOKEN"

User Management Endpoints
3.1 Get All Users (Paginated)
GET /users?page=1&limit=10&search=john&role_id=4&is_active=true
Description: Get all users with pagination and filters
Query Parameters:
ParameterTypeRequiredDescriptionpagenumberNoPage number (default: 1)limitnumberNoRecords per page (default: 20, max: 100)searchstringNoSearch by username, email, first name, or last namerole_idnumberNoFilter by roledepartment_idnumberNoFilter by departmentis_activebooleanNoFilter by active status
Success Response (200):
json{
  "success": true,
  "message": "Users fetched successfully",
  "timestamp": "2025-10-11T17:55:29.538Z",
  "data": [
    {
      "user_id": 1,
      "username": "admin",
      "email": "admin@ithelpdesk.com",
      "first_name": "System",
      "last_name": "Administrator",
      "full_name": "System Administrator",
      "phone_number": "+1-555-0100",
      "is_active": true,
      "is_locked": false,
      "last_login": "2025-10-11T23:20:33.260Z",
      "created_at": "2025-10-11T20:07:36.903Z",
      "role_id": 1,
      "role_name": "Administrator",
      "role_code": "ADMIN",
      "department_id": 1,
      "department_name": "Information Technology",
      "department_code": "IT"
    }
  ],
  "meta": {
    "totalRecords": 1,
    "totalPages": 1,
    "currentPage": 1,
    "recordsPerPage": 10,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
cURL Command:
bashcurl -X GET "http://localhost:5000/api/v1/users?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

3.2 Get User by ID
GET /users/:id
Description: Get detailed information about a specific user
Success Response (200):
json{
  "success": true,
  "message": "User fetched successfully",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "data": {
    "user_id": 2,
    "username": "john.doe",
    "email": "john.doe@ithelpdesk.com",
    "first_name": "John",
    "last_name": "Doe",
    "full_name": "John Doe",
    "phone_number": "+1-555-0123",
    "profile_picture": null,
    "is_active": true,
    "is_locked": false,
    "last_login": null,
    "created_at": "2025-10-11T18:01:42.515Z",
    "updated_at": "2025-10-11T18:01:42.515Z",
    "role_id": 4,
    "role_name": "User",
    "role_code": "USER",
    "role_description": "Standard user who can create and view own tickets",
    "department_id": 1,
    "department_name": "Information Technology",
    "department_code": "IT",
    "department_description": "IT support and infrastructure team",
    "tickets_created": 0,
    "tickets_assigned": 0,
    "tickets_resolved": 0
  }
}
cURL Command:
bashcurl -X GET http://localhost:5000/api/v1/users/2 \
  -H "Authorization: Bearer YOUR_TOKEN"

3.3 Create New User
POST /users
Description: Create a new user (Admin/Manager only)
Request Body:
json{
  "username": "jane.smith",
  "email": "jane.smith@ithelpdesk.com",
  "password": "Jane@12345",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone_number": "+1-555-0124",
  "role_id": 3,
  "department_id": 1
}
Validation Rules:

username: 3-50 characters, alphanumeric + dots + underscores
email: Valid email format
password: Min 8 chars, 1 uppercase, 1 number, 1 special char
first_name: 2-50 characters
last_name: 2-50 characters
role_id: Valid role ID (1=Admin, 2=Manager, 3=Engineer, 4=User)
department_id: Optional, valid department ID
phone_number: Optional, valid phone format

Success Response (201):
json{
  "success": true,
  "message": "User created successfully",
  "timestamp": "2025-10-11T18:01:42.542Z",
  "data": {"user_id": 2,
    "username": "john.doe",
    "email": "john.doe@ithelpdesk.com",
    "first_name": "John",
    "last_name": "Doe",
    "role_name": "User",
    "department_name": "Information Technology"
  }
}
Error Response (409) - Duplicate Username:
json{
  "success": false,
  "message": "Username already exists",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
cURL Command:
bashcurl -X POST http://localhost:5000/api/v1/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username":"jane.smith",
    "email":"jane.smith@ithelpdesk.com",
    "password":"Jane@12345",
    "first_name":"Jane",
    "last_name":"Smith",
    "phone_number":"+1-555-0124",
    "role_id":3,
    "department_id":1
  }'

3.4 Update User
PUT /users/:id
Description: Update user information (Admin/Manager only)
Request Body (all fields optional):
json{
  "email": "jane.updated@ithelpdesk.com",
  "first_name": "Jane",
  "last_name": "Smith Updated",
  "phone_number": "+1-555-0125",
  "role_id": 2,
  "department_id": 2,
  "is_active": true
}
Success Response (200):
json{
  "success": true,
  "message": "User updated successfully",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "data": {
    "user_id": 3,
    "username": "jane.smith",
    "email": "jane.updated@ithelpdesk.com",
    "first_name": "Jane",
    "last_name": "Smith Updated",
    "phone_number": "+1-555-0125",
    "is_active": true,
    "role_name": "Manager",
    "department_name": "Human Resources"
  }
}
cURL Command:
bashcurl -X PUT http://localhost:5000/api/v1/users/3 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"jane.updated@ithelpdesk.com",
    "role_id":2
  }'

3.5 Delete User (Soft Delete)
DELETE /users/:id
Description: Deactivate user account (Admin only)
Success Response (200):
json{
  "success": true,
  "message": "User deleted successfully",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
Notes:

Soft delete - user is deactivated, not removed from database
User cannot delete their own account
All user sessions are invalidated

cURL Command:
bashcurl -X DELETE http://localhost:5000/api/v1/users/3 \
  -H "Authorization: Bearer YOUR_TOKEN"

Ticket Management Endpoints
4.1 Get All Tickets (Paginated & Filtered)
GET /tickets?page=1&limit=10&status_id=1&priority_id=2&search=laptop
Description: Get all tickets with pagination and filters
Query Parameters:
ParameterTypeRequiredDescriptionpagenumberNoPage number (default: 1)limitnumberNoRecords per page (default: 20)searchstringNoSearch by ticket number, subject, or descriptionstatus_idnumberNoFilter by statuspriority_idnumberNoFilter by prioritycategory_idnumberNoFilter by categoryassigned_tonumberNoFilter by assigned engineerrequester_idnumberNoFilter by requesterdepartment_idnumberNoFilter by department
Success Response (200):
json{
  "success": true,
  "message": "Tickets fetched successfully",
  "timestamp": "2025-10-11T17:55:51.183Z",
  "data": [
    {
      "ticket_id": 1,
      "ticket_number": "TKT-20251011-0001",
      "subject": "Laptop not turning on",
      "description": "My work laptop is not powering on. Need urgent help.",
      "created_at": "2025-10-11T23:31:30.576Z",
      "updated_at": "2025-10-11T23:31:30.576Z",
      "due_date": "2025-10-12T07:31:30.576Z",
      "resolved_at": null,
      "is_escalated": false,
      "category_name": "Hardware Issue",
      "category_code": "HARDWARE",
      "priority_name": "High",
      "priority_code": "HIGH",
      "priority_level": 2,
      "priority_color": "#EA580C",
      "status_name": "Open",
      "status_code": "OPEN",
      "status_color": "#3B82F6",
      "requester_name": "System Administrator",
      "requester_email": "admin@ithelpdesk.com",
      "assigned_to_id": null,
      "assigned_to_name": null,
      "department_name": "Information Technology",
      "comments_count": 0,
      "attachments_count": 0
    }
  ],
  "meta": {
    "totalRecords": 1,
    "totalPages": 1,
    "currentPage": 1,
    "recordsPerPage": 10,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
cURL Command:
bashcurl -X GET "http://localhost:5000/api/v1/tickets?page=1&limit=10&status_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"

4.2 Get Ticket by ID
GET /tickets/:id
Description: Get detailed ticket information including comments, attachments, and activities
Success Response (200):
json{
  "success": true,
  "message": "Ticket fetched successfully",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "data": {
    "ticket_id": 1,
    "ticket_number": "TKT-20251011-0001",
    "subject": "Laptop not turning on",
    "description": "My work laptop is not powering on. I tried charging it but no response. Need urgent help.",
    "resolution_notes": null,
    "created_at": "2025-10-11T23:31:30.576Z",
    "updated_at": "2025-10-11T23:31:30.576Z",
    "due_date": "2025-10-12T07:31:30.576Z",
    "resolved_at": null,
    "closed_at": null,
    "is_escalated": false,
    "escalated_at": null,
    "escalation_reason": null,
    "rating": null,
    "feedback": null,
    "first_response_at": null,
    "first_response_sla_met": null,
    "resolution_sla_met": null,
    "category_id": 1,
    "category_name": "Hardware Issue",
    "category_code": "HARDWARE",
    "sla_hours": 24,
    "priority_id": 2,
    "priority_name": "High",
    "priority_code": "HIGH",
    "priority_level": 2,
    "priority_color": "#EA580C",
    "response_time_hours": 2,
    "resolution_time_hours": 8,
    "status_id": 1,
    "status_name": "Open",
    "status_code": "OPEN",
    "status_type": "OPEN",
    "status_color": "#3B82F6",
    "is_final_status": false,
    "requester_id": 1,
    "requester_username": "admin",
    "requester_email": "admin@ithelpdesk.com",
    "requester_name": "System Administrator",
    "requester_phone": "+1-555-0100",
    "assigned_to_id": null,
    "assigned_to_username": null,
    "assigned_to_email": null,
    "assigned_to_name": null,
    "escalated_to_id": null,
    "escalated_to_name": null,
    "department_id": 1,
    "department_name": "Information Technology",
    "department_code": "IT",
    "created_by_name": "System Administrator",
    "attachments": [],
    "comments": [],
    "activities": [
      {
        "activity_id": 1,
        "activity_type": "CREATED",
        "field_name": null,
        "old_value": null,
        "new_value": null,
        "description": "Ticket created",
        "performed_at": "2025-10-11T23:31:30.576Z",
        "performed_by_name": "System Administrator"
      }
    ]
  }
}
cURL Command:
bashcurl -X GET http://localhost:5000/api/v1/tickets/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

4.3 Create New Ticket
POST /tickets
Description: Create a new ticket
Request Body:
json{
  "subject": "Email not syncing on mobile device",
  "description": "I cannot receive emails on my mobile phone. The inbox shows no new messages even though I can see them on my desktop. Please help resolve this issue as soon as possible.",
  "category_id": 6,
  "priority_id": 3,
  "department_id": 1
}
Validation Rules:

subject: 5-200 characters
description: 10-5000 characters
category_id: Valid category ID (1-10)
priority_id: Valid priority ID (1-5)
department_id: Optional, valid department ID

Success Response (201):
json{
  "success": true,
  "message": "Ticket created successfully",
  "timestamp": "2025-10-11T18:01:30.659Z",
  "data": {
    "ticket_id": 1,
    "ticket_number": "TKT-20251011-0001",
    "subject": "Laptop not turning on",
    "description": "My work laptop is not powering on. Need urgent help.",
    "created_at": "2025-10-11T23:31:30.576Z",
    "due_date": "2025-10-12T07:31:30.576Z",
    "category_name": "Hardware Issue",
    "priority_name": "High",
    "priority_color": "#EA580C",
    "status_name": "Open",
    "status_color": "#3B82F6"
  }
}
Notes:

Ticket number is auto-generated with format: TKT-YYYYMMDD-XXXX
Due date is calculated based on priority SLA
Status is automatically set to "Open"
Activity log entry is created automatically
Notifications are sent to admins/managers

cURL Command:
bashcurl -X POST http://localhost:5000/api/v1/tickets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject":"Email not syncing on mobile device",
    "description":"I cannot receive emails on my mobile phone. Please help.",
    "category_id":6,
    "priority_id":3,
    "department_id":1
  }'

4.4 Update Ticket
PUT /tickets/:id
Description: Update ticket information
Request Body (all fields optional):
json{
  "subject": "Updated subject",
  "description": "Updated description",
  "category_id": 2,
  "priority_id": 1,
  "status_id": 2,
  "assigned_to": 1,
  "resolution_notes": "Issue resolved by replacing power adapter"
}
Success Response (200):
json{
  "success": true,
  "message": "Ticket updated successfully",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "data": {
    "ticket_id": 1,
    "ticket_number": "TKT-20251011-0001",
    "subject": "Laptop not turning on",
    "description": "My work laptop is not powering on. Need urgent help.",
    "updated_at": "2025-10-11T18:05:00.000Z",
    "category_name": "Hardware Issue",
    "priority_name": "Critical",
    "status_name": "In Progress",
    "assigned_to_name": "System Administrator"
  }
}
Notes:

All changes are logged in ticket_activities table
Notifications are sent to relevant users
Assigning an engineer updates first_response_at if null
Changing status to RESOLVED updates resolved_at timestamp

cURL Command:
bashcurl -X PUT http://localhost:5000/api/v1/tickets/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status_id":2,
    "assigned_to":1,
    "priority_id":1
  }'

4.5 Add Comment to Ticket
POST /tickets/:id/comments
Description: Add a comment to a ticket
Request Body:
json{
  "comment_text": "I have checked the device and it appears to be a hardware issue. Scheduling a replacement.",
  "is_internal": false
}
Validation Rules:

comment_text: 1-2000 characters
is_internal: Boolean (true for internal notes, false for public comments)

Success Response (201):
json{
  "success": true,
  "message": "Comment added successfully",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "data": {
    "comment_id": 1,
    "comment_text": "I have checked the device and it appears to be a hardware issue. Scheduling a replacement.",
    "is_internal": false,
    "commented_at": "2025-10-11T18:00:00.000Z",
    "commenter_name": "System Administrator",
    "commenter_role": "Administrator"
  }
}
Notes:

Internal comments are only visible to engineers/admins
Public comments are visible to ticket requester
Activity log entry is created automatically

cURL Command:
bashcurl -X POST http://localhost:5000/api/v1/tickets/1/comments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "comment_text":"Working on this issue. Will update soon.",
    "is_internal":false
  }'

4.6 Delete Ticket
DELETE /tickets/:id
Description: Delete/mark ticket for deletion (Admin only)
Success Response (200):
json{
  "success": true,
  "message": "Ticket deletion logged successfully",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
Notes:

This logs a deletion activity but doesn't actually delete the ticket
Requires can_delete_tickets permission

cURL Command:
bashcurl -X DELETE http://localhost:5000/api/v1/tickets/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

Error Responses
400 Bad Request - Validation Error
json{
  "success": false,
  "message": "Validation failed",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "meta": {
    "errors": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ]
  }
}
401 Unauthorized - No Token
json{
  "success": false,
  "message": "Access denied. No token provided.",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
401 Unauthorized - Invalid Token
json{
  "success": false,
  "message": "Invalid token. Please login again.",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
401 Unauthorized - Expired Token
json{
  "success": false,
  "message": "Invalid or expired session. Please login again.",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
403 Forbidden - Insufficient Permissions
json{
  "success": false,
  "message": "You do not have permission to perform this action.",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
403 Forbidden - Account Deactivated
json{
  "success": false,
  "message": "Your account has been deactivated.",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
403 Forbidden - Account Locked
json{
  "success": false,
  "message": "Your account has been locked. Please contact administrator.",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
404 Not Found
json{
  "success": false,
  "message": "Resource not found",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "meta": {
    "requestedUrl": "/api/v1/users/999",
    "method": "GET"
  }
}
409 Conflict - Duplicate Entry
json{
  "success": false,
  "message": "Username already exists",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
429 Too Many Requests - Rate Limit
json{
  "success": false,
  "message": "Too many requests, please try again later.",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
500 Internal Server Error
json{
  "success": false,
  "message": "Internal Server Error",
  "timestamp": "2025-10-11T18:00:00.000Z"
}
500 Database Error
json{
  "success": false,
  "message": "Database error",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "meta": {
    "error": "Error details (only in development mode)"
  }
}

Testing Tips
1. Using cURL (Cross-platform)
Save token to variable (Linux/Mac):
bashTOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo $TOKEN
Use token in subsequent requests:
bashcurl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
2. Using PowerShell (Windows)
Save token to variable:
powershell$response = Invoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/login" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"username":"admin","password":"Admin@123"}'
$token = $response.data.token
Write-Host $token
Use token in subsequent requests:
powershellInvoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/me" -Method Get -Headers @{"Authorization"="Bearer $token"}
3. Using Postman

Import Collection:

Import postman_collection.json file
Collection includes all endpoints


Set Collection Variable:

After login, token is auto-saved to collection variable
Or manually set token variable in collection


Test All Endpoints:

Click through each request in the collection
All endpoints use {{token}} variable automatically



4. Using Python requests
pythonimport requests

# Login
response = requests.post(
    'http://localhost:5000/api/v1/auth/login',
    json={'username': 'admin', 'password': 'Admin@123'}
)
token = response.json()['data']['token']

# Use token
headers = {'Authorization': f'Bearer {token}'}
response = requests.get(
    'http://localhost:5000/api/v1/auth/me',
    headers=headers
)
print(response.json())
5. Using JavaScript fetch
javascript// Login
const loginResponse = await fetch('http://localhost:5000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
});
const { data } = await loginResponse.json();
const token = data.token;

// Use token
const response = await fetch('http://localhost:5000/api/v1/auth/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const userData = await response.json();
console.log(userData);
6. Common Testing Scenarios
Scenario 1: Complete User Workflow
bash# 1. Login as admin
# 2. Create a new user (Engineer)
# 3. Get all users
# 4. Login as new user
# 5. Create a ticket
# 6. Get all tickets
# 7. Admin assigns ticket to engineer
# 8. Engineer adds comment
# 9. Engineer resolves ticket
Scenario 2: Ticket Lifecycle
bash# 1. User creates ticket (status: Open)
# 2. Admin assigns to engineer (status: In Progress)
# 3. Engineer adds internal note
# 4. Engineer adds public comment
# 5. Engineer resolves ticket (status: Resolved)
# 6. Admin closes ticket (status: Closed)
Scenario 3: Permission Testing
bash# 1. Login as regular user
# 2. Try to create another user (should fail - 403)
# 3. Try to view all tickets (should show only own tickets)
# 4. Login as admin
# 5. View all tickets (should show all)
# 6. Delete a user (should succeed)

Quick Reference
Available Roles

Administrator (ADMIN) - Full access
Manager (MANAGER) - Department and analytics access
Engineer (ENGINEER) - Ticket handling
User (USER) - Create and view own tickets

Available Categories

Hardware Issue
Software Issue
Network Issue
Account Access
New Request
Email Issue
Security Issue
Performance Issue
Training Request
Other

Available Priorities

Critical - 1h response, 4h resolution
High - 2h response, 8h resolution
Medium - 4h response, 24h resolution
Low - 8h response, 48h resolution
Planning - 24h response, 168h resolution

Available Statuses

Open - New ticket
In Progress - Being worked on
Pending - Waiting for something
On Hold - Temporarily paused
Resolved - Issue fixed
Closed - Ticket closed
Cancelled - Ticket cancelled

Available Departments

Information Technology (IT)
Human Resources (HR)
Finance (FIN)
Operations (OPS)
Sales (SALES)
Marketing (MKT)


API Response Format
All API responses follow this consistent format:
Success Response:
json{
  "success": true,
  "message": "Operation successful message",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "data": { /* Response data */ },
  "meta": { /* Optional metadata like pagination */ }
}
Error Response:
json{
  "success": false,
  "message": "Error message",
  "timestamp": "2025-10-11T18:00:00.000Z",
  "meta": { /* Optional error details */ }
}

Rate Limiting

Window: 15 minutes
Max Requests: 100 requests per IP
Headers:

X-RateLimit-Limit: Maximum requests allowed
X-RateLimit-Remaining: Remaining requests
X-RateLimit-Reset: Time when limit resets




Security Notes

Always use HTTPS in production
Store tokens securely (not in localStorage for sensitive apps)
Token expires after 8 hours - implement refresh logic
Failed login attempts - Account locks after 5 failed attempts
Password requirements - Enforced on backend
SQL Injection protection - Parameterized queries used
XSS protection - Input sanitization implemented
CORS - Configure appropriately for production


Support
For issues or questions:

Check backend logs in logs/ directory
All logs are in IST timezone
Each request has detailed logging
Error responses include helpful messages


Last Updated: October 11, 2025
API Version: 1.0.0
Backend Port: 5000
Database: Microsoft SQL Server