const jwt = require('jsonwebtoken');

const generateJWT = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured. Please set JWT_SECRET in your .env file.');
  }

  const payload = {
    email: user.email,
    role: user.role,
    userId: user._id.toString(),
    name: user.name,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

module.exports = generateJWT;

