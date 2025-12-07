const Admin = require('../models/Admin.model');
const User = require('../models/User.model');

const initializeAdmin = async () => {
  try {
    
    const existingAdmin = await Admin.findOne({
      email: 'admin@contestarena.com',
    });

    if (existingAdmin) {
      console.log('Admin account already exists');
      return;
    }

    // Create admin in Admin collection
    const admin = await Admin.create({
      email: 'admin@contestarena.com',
      password: 'admin123',
      name: 'Admin',
    });

    console.log('Admin account created in Admin collection:', admin.email);

    // Also create/update user in User collection with admin role
    let user = await User.findOne({ email: 'admin@contestarena.com' });

    if (user) {
      // Update existing user to admin role
      user.role = 'admin';
      await user.save();
      console.log('User role updated to admin in User collection');
    } else {
      // Create new user with admin role
      user = await User.create({
        email: 'admin@contestarena.com',
        name: 'Admin',
        photoURL: '',
        role: 'admin',
      });
      console.log('Admin user created in User collection');
    }
  } catch (error) {
    console.error('Error initializing admin:', error);
    // Don't throw error, just log it
  }
};

module.exports = initializeAdmin;


