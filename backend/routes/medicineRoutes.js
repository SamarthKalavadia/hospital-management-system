const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');

// GET all medicines
router.get('/', async (req, res) => {
  try {
    const meds = await Medicine.find().sort({
      name: 1
    });
    res.json(meds);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// GET one
router.get('/:id', async (req, res) => {
  try {
    const m = await Medicine.findById(req.params.id);
    if (!m) return res.status(404).json({});
    res.json(m);
  } catch (err) {
    console.error(err);
    res.status(500).json({});
  }
});

// CREATE
router.post('/', async (req, res) => {
  try {
    const {
      name,
      manufacturer,
      quantity,
      expiry
    } = req.body;

    // Validate non-negative quantity
    if (quantity !== undefined && (isNaN(quantity) || Number(quantity) < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Quantity cannot be negative'
      });
    }

    const med = new Medicine({
      name,
      manufacturer,
      quantity: Math.max(0, Number(quantity) || 0),
      expiry
    });
    await med.save();
    res.json({
      success: true,
      med
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  try {
    const update = req.body;
    const m = await Medicine.findByIdAndUpdate(req.params.id, update, {
      new: true
    });
    res.json({
      success: true,
      med: m
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// UPDATE QUANTITY ONLY
router.patch('/:id/quantity', async (req, res) => {
  try {
    const {
      quantity
    } = req.body;

    // Validate non-negative quantity
    if (quantity === undefined || isNaN(quantity) || Number(quantity) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a non-negative number'
      });
    }

    const m = await Medicine.findByIdAndUpdate(
      req.params.id, {
        quantity: Number(quantity)
      }, {
        new: true
      }
    );
    if (!m) return res.status(404).json({
      success: false,
      message: 'Medicine not found'
    });
    res.json({
      success: true,
      med: m
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await Medicine.findByIdAndDelete(req.params.id);
    res.json({
      success: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
