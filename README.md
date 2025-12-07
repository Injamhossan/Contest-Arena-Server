# ContestArena Server

A production-ready REST API for a contest management platform built with Node.js, Express.js, and MongoDB.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control (admin, creator, user)
- **Contest Management**: Create, edit, delete, and approve contests
- **Payment Integration**: Stripe payment processing for contest entry fees
- **Submission System**: Users can join contests and submit their work
- **Leaderboard**: Track winners and display rankings
- **Admin Panel**: Admin can approve contests, manage users, and change roles

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database (with Mongoose ODM)
- **JWT** - Authentication & authorization
- **Stripe** - Payment processing
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- Stripe account (for payment processing)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ContestArena-Server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: A secure random string for JWT signing
   - `STRIPE_SECRET_KEY`: Your Stripe secret key (test mode)
   - `FRONTEND_URL`: Your frontend URL for CORS

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

## Default Admin Account

On first startup, the server automatically creates a default admin account:

- **Email**: `admin@contestarena.com`
- **Password**: `admin123`

This account is created in both the `Admin` collection (for admin-specific authentication) and the `User` collection (with admin role).

## API Endpoints

### Authentication

- `POST /api/auth/jwt` - Create or get JWT token
  - Body: `{ email, name, photoURL }`
  - Returns: `{ token, user }`

- `GET /api/auth/me` - Get current user profile (Protected)
  - Headers: `Authorization: Bearer <token>`

### Users

- `GET /api/users` - Get all users (Admin only, paginated)
  - Query params: `page`, `limit`

- `GET /api/users/:id` - Get user by ID (Authenticated)

- `PATCH /api/users/:id/role` - Update user role (Admin only)
  - Body: `{ role: 'user' | 'creator' | 'admin' }`

- `PATCH /api/users/:id` - Update user profile
  - Body: `{ name, photoURL, bio, address }`

### Contests

- `GET /api/contests` - Get all contests (Public, paginated)
  - Query params: `status`, `type`, `search`, `page`, `limit`

- `GET /api/contests/popular` - Get popular contests (Public)
  - Query params: `limit`

- `GET /api/contests/winners/recent` - Get recent winners (Public)
  - Query params: `limit`

- `GET /api/contests/:id` - Get contest by ID (Public)

- `POST /api/contests` - Create contest (Creator only)
  - Body: `{ name, image, description, shortDescription, price, prizeMoney, taskInstructions, contestType, deadline }`

- `PUT /api/contests/:id` - Update contest (Creator only, pending only)

- `DELETE /api/contests/:id` - Delete contest (Creator can delete own pending, Admin can delete any)

- `PATCH /api/contests/:id/status` - Approve contest (Admin only)
  - Body: `{ status: 'confirmed' }`

- `PATCH /api/contests/:id/winner` - Declare winner (Creator only, after deadline)
  - Body: `{ winnerUserId }`

### Participations

- `POST /api/participations` - Join contest (User only)
  - Body: `{ contestId, submissionLink, paymentId }`

- `GET /api/participations/me` - Get my participations (Authenticated)
  - Query params: `sort=deadline`

- `GET /api/participations/contest/:contestId` - Get contest submissions (Creator only)

- `PATCH /api/participations/:id` - Update submission (User only, before deadline)
  - Body: `{ submissionLink, submissionText }`

### Payments

- `POST /api/payments/create-intent` - Create Stripe payment intent (Authenticated)
  - Body: `{ price, contestId }`
  - Returns: `{ clientSecret, paymentId }`

- `POST /api/payments/confirm` - Confirm payment (Authenticated)
  - Body: `{ paymentId, transactionId }`

- `POST /api/payments/webhook` - Stripe webhook handler

- `GET /api/payments/me` - Get my payment history (Authenticated)

### Leaderboard

- `GET /api/leaderboard` - Get leaderboard (Public)
  - Query params: `limit`

## Database Collections

- **users**: All user data (name, email, role, winsCount, etc.)
- **admin**: Admin-specific authentication data
- **contests**: Contest information
- **submissions**: User submissions/participations
- **payments**: Payment transaction details

## Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Helmet.js for security headers
- CORS configuration
- Input validation
- Error handling middleware
- Password hashing (for admin accounts)

## Error Handling

The API uses centralized error handling middleware that:
- Handles validation errors
- Handles duplicate key errors
- Handles JWT errors
- Returns appropriate HTTP status codes
- Provides meaningful error messages

## Pagination

Several endpoints support pagination:
- Query parameters: `page` (default: 1), `limit` (default: 10)
- Response includes: `data`, `total`, `page`, `pages`, `limit`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 5000) |
| `NODE_ENV` | Environment (development/production) | No |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret key for JWT signing | Yes |
| `JWT_EXPIRES_IN` | JWT expiration time | No (default: 7d) |
| `STRIPE_SECRET_KEY` | Stripe secret key | Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | No |
| `FRONTEND_URL` | Frontend URL for CORS | No (default: http://localhost:3000) |

## Project Structure

```
src/
├── config/
│   ├── db.js              # MongoDB connection
│   └── firebaseAdmin.js   # Firebase admin config (if needed)
├── controllers/
│   ├── auth.controller.js
│   ├── user.controller.js
│   ├── contest.controller.js
│   ├── participation.controller.js
│   ├── payment.controller.js
│   └── leaderboard.controller.js
├── middleware/
│   ├── verifyJWT.js       # JWT verification middleware
│   └── roleChecker.js    # Role-based access control
├── models/
│   ├── User.model.js
│   ├── Admin.model.js
│   ├── Contest.model.js
│   ├── Submission.model.js
│   └── Payment.model.js
├── routes/
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── contest.routes.js
│   ├── participation.routes.js
│   ├── payment.routes.js
│   └── leaderboard.routes.js
├── scripts/
│   └── initializeAdmin.js # Admin initialization script
├── utils/
│   └── generateJWT.js    # JWT token generation
├── app.js                 # Express app configuration
└── server.js              # Server entry point
```

## Testing

To test the API, you can use tools like:
- Postman
- cURL
- Thunder Client (VS Code extension)
- Insomnia

Example request to create JWT:
```bash
curl -X POST http://localhost:5000/api/auth/jwt \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "name": "John Doe"}'
```

## License

ISC

## Support

For issues or questions, please contact the development team.


