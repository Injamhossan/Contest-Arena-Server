const jwt = require('jsonwebtoken');

const generateJWT = (user) => {
  const payload = {
    email: user.email,
    role: user.role,
    userId: user._id.toString(),
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

module.exports = generateJWT;

