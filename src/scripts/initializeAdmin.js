const { client } = require('../config/db');
const bcrypt = require('bcrypt');

const initializeAdmin = async () => {
  try {
    const db = client.db(process.env.DB_NAME || 'contest_arena');
    const adminCollection = db.collection('admins');
    const usersCollection = db.collection('users');

    const existingAdmin = await adminCollection.findOne({
      email: 'admin@contestarena.com',
    });

    if (existingAdmin) {
      console.log('Admin account already exists');
    } else {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await adminCollection.insertOne({
        email: 'admin@contestarena.com',
        password: hashedPassword,
        name: 'Admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('Admin account created in Admin collection');
    }

    const user = await usersCollection.findOne({ email: 'admin@contestarena.com' });

    if (user) {
      // Update existing user to admin role
      await usersCollection.updateOne(
        { email: 'admin@contestarena.com' },
        { $set: { role: 'admin', updatedAt: new Date() } }
      );
      console.log('User role updated to admin in User collection');
    } else {
      await usersCollection.insertOne({
        email: 'admin@contestarena.com',
        name: 'Admin',
        photoURL: '',
        role: 'admin',
        winsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Admin user created in User collection');
    }
  } catch (error) {
    console.error('Error initializing admin:', error);
  }
};

module.exports = initializeAdmin;


