const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        default: null,
    },
    googleId: { type: String, default: null, sparse: true },
    appleId:  { type: String, default: null, sparse: true },
    provider: { type: String, default: 'local' },
    createdAt: {
        type: Date,
        default: Date.now
    }
});


userSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);

