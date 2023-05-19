const express = require('express');
const mongoose = require('mongoose');

// Create Express app
const app = express();

// Parse JSON request bodies
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb+srv://runo:Runo123@projectcluster.tx9gp0v.mongodb.net/runo?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Connected to MongoDB');
    // Start the server after successful database connection
    app.listen(3000, () => {
      console.log('Server started on port 3000');
    });
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB:', error);
  });

// Define Mongoose schema and models (e.g., User, Slot)

// User schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  age: { type: Number, required: true },
  pincode: { type: String, required: true },
  aadharNo: { type: String, required: true },
  password: { type: String, required: true },
  vaccinationStatus: { type: String, default: 'none' },
  registeredSlot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot' },
});

// Slot schema
const slotSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  availableDoses: { type: Number, required: true },
});

const User = mongoose.model('User', userSchema);
const Slot = mongoose.model('Slot', slotSchema);

// Implement the APIs

// User Registration API
app.post('/api/users/register', async (req, res) => {
  try {
    // Extract user data from the request body
    const { name, phoneNumber, age, pincode, aadharNo, password } = req.body;

    // Create a new user document
    const user = new User({
      name,
      phoneNumber,
      age,
      pincode,
      aadharNo,
      password,
    });

    // Save the user to the database
    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('User registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// User Login API
app.post('/api/users/login', async (req, res) => {
  try {
    // Extract user credentials from the request body
    const { phoneNumber, password } = req.body;

    // Find the user by phone number and password
    const user = await User.findOne({ phoneNumber, password });

    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
    } else {
      res.status(200).json({ message: 'Login successful' });
    }
  } catch (error) {
    console.error('User login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Available Time Slots API
app.get('/api/slots/available', async (req, res) => {
  try {
    // Get the current date
    const currentDate = new Date();

    // Find the slots for the current date
    const slots = await Slot.find({ date: currentDate });

    // Get the user's vaccination status (assuming the user ID is available in the request)
    const userId = req.userId; // Replace with your actual way of getting the user ID
    const user = await User.findById(userId);

    // Filter the slots based on the user's vaccination status
    let filteredSlots = [];

    if (user.vaccinationStatus === 'First dose completed') {
      // User has completed the first dose, filter only the second dose slots
      filteredSlots = slots.filter(slot => slot.vaccineType === 'Second dose');
    } else if (user.vaccinationStatus === 'All completed') {
      // User has completed all doses, no slots available
      filteredSlots = [];
    } else {
      // User has not completed any dose, filter only the first dose slots
      filteredSlots = slots.filter(slot => slot.vaccineType === 'First dose');
    }

    res.status(200).json({ slots: filteredSlots });
  } catch (error) {
    console.error('Available time slots error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Vaccine Registration API
// User Slot Registration API
app.post('/api/slots/register', async (req, res) => {
  try {
    const { userId, slotId } = req.body;

    // Find the user and slot
    const user = await User.findById(userId);
    const slot = await Slot.findById(slotId);

    // Check if the user or slot doesn't exist
    if (!user || !slot) {
      return res.status(404).json({ message: 'User or slot not found' });
    }

    // Check if the user has already registered for the slot
    if (slot.registeredUsers.includes(user._id)) {
      return res.status(400).json({ message: 'User already registered for the slot' });
    }

    // Check if the slot is full (all vaccine doses are registered)
    if (slot.registeredUsers.length >= 10) {
      return res.status(400).json({ message: 'Slot is full' });
    }

    // Update the user's vaccination status
    if (slot.vaccineType === 'First dose') {
      user.vaccinationStatus = 'First dose completed';
    } else if (slot.vaccineType === 'Second dose') {
      user.vaccinationStatus = 'All completed';
    }

    // Register the user for the slot
    slot.registeredUsers.push(user._id);

    // Save the updated user and slot documents
    await Promise.all([user.save(), slot.save()]);

    res.status(200).json({ message: 'User registered for the slot successfully' });
  } catch (error) {
    console.error('User slot registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Update Registered Slot API
app.put('/api/slots/:slotId', async (req, res) => {
  try {
    // Extract user ID and new slot ID from the request body
    const { userId, newSlotId } = req.body;

    // Find the user by ID
    const user = await User.findById(userId);

    // Find the new slot by ID
    const newSlot = await Slot.findById(newSlotId);

    // Check if the user or new slot doesn't exist
    if (!user || !newSlot) {
      return res.status(404).json({ message: 'User or new slot not found' });
    }

    // Check if the user is registered for the current slot
    if (!user.registeredSlot || user.registeredSlot.toString() !== req.params.slotId) {
      return res.status(400).json({ message: 'User is not registered for the current slot' });
    }

    // Check if the new slot is already full (all vaccine doses are registered)
    if (newSlot.registeredUsers.length >= 10) {
      return res.status(400).json({ message: 'New slot is full' });
    }

    // Update the user's registered slot and vaccination status
    user.registeredSlot = newSlot._id;

    if (newSlot.vaccineType === 'First dose') {
      user.vaccinationStatus = 'First dose completed';
    } else if (newSlot.vaccineType === 'Second dose') {
      user.vaccinationStatus = 'All completed';
    }

    // Save the updated user document
    await user.save();

    res.status(200).json({ message: 'Slot updated successfully' });
  } catch (error) {
    console.error('Update registered slot error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Admin Login API
app.post('/api/admin/login', async (req, res) => {
  try {
    // Extract admin credentials from the request body
    const { username, password } = req.body;

    // Check the admin credentials (manually created in the database)
    if (username !== 'admin' || password !== 'adminpassword') {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    res.status(200).json({ message: 'Admin login successful' });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Total Registered Users API (Optional)
app.get('/api/admin/users/total', async (req, res) => {
  try {
    const { age, pincode, vaccinationStatus } = req.query;

    let query = {};

    // Apply filters if provided
    if (age) {
      query.age = age;
    }
    if (pincode) {
      query.pincode = pincode;
    }
    if (vaccinationStatus) {
      query.vaccinationStatus = vaccinationStatus;
    }

    // Get the total number of registered users based on the query
    const totalUsers = await User.countDocuments(query);

    res.status(200).json({ totalUsers });
  } catch (error) {
    console.error('Total registered users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Registered Slots API
app.get('/api/admin/slots/:date', async (req, res) => {
  try {
    // Extract the date from the request parameters
    const { date } = req.params;

    // Get the start and end timestamps for the specified date
    const startOfDay = new Date(date).setHours(0, 0, 0, 0);
    const endOfDay = new Date(date).setHours(23, 59, 59, 999);

    // Find the registered slots for the specified date
    const firstDoseSlots = await Slot.find({
      vaccineType: 'First dose',
      registeredAt: { $gte: startOfDay, $lte: endOfDay }
    }).populate('registeredUsers');

    const secondDoseSlots = await Slot.find({
      vaccineType: 'Second dose',
      registeredAt: { $gte: startOfDay, $lte: endOfDay }
    }).populate('registeredUsers');

    const totalSlots = await Slot.find({
      registeredAt: { $gte: startOfDay, $lte: endOfDay }
    }).populate('registeredUsers');

    const slots = {
      firstDose: firstDoseSlots,
      secondDose: secondDoseSlots,
      total: totalSlots
    };

    res.status(200).json({ slots });
  } catch (error) {
    console.error('Registered slots error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

