/**
 * Middleware to verify user role
 * @param {string|string[]} allowedRoles - Single role or array of roles
 */
const verifyRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const userRole = req.user.role;
    const isAllowed = Array.isArray(allowedRoles)
      ? allowedRoles.includes(userRole)
      : userRole === allowedRoles;

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Access denied.',
      });
    }

    next();
  };
};

module.exports = verifyRole;

