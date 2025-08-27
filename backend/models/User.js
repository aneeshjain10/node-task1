const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  mobileNo: {
    type: String,
    required: true,
    validate: {
      validator: v => /^\d{10}$/.test(v),
      message: props => `${props.value} is not a valid 10 digit mobile number`
    }
  },
  emailId: {
    type: String,
    required: true,
    unique: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String
  },
  loginId: {
    type: String,
    required: true,
    unique: true,
    match: /^[a-zA-Z0-9]{8}$/
  },
  password: {
    type: String,
    required: true,
    match: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{6,}$/
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
