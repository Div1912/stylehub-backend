const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  comparePrice: {
    type: Number,
    min: 0
  },
  category: {
    type: String,
    required: true,
    enum: ['men', 'women', 'kids', 'accessories']
  },
  subCategory: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  images: [{
    url: String,
    alt: String
  }],
  variants: [{
    size: String,
    color: String,
    stock: Number,
    sku: String
  }],
  specifications: [{
    name: String,
    value: String
  }],
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: String,
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [String],
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'deleted'],
    default: 'draft'
  },
  featured: {
    type: Boolean,
    default: false
  },
  searchScore: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for search
productSchema.index({
  name: 'text',
  description: 'text',
  brand: 'text',
  tags: 'text'
});

// Method to update average rating
productSchema.methods.updateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.ratings.average = 0;
    this.ratings.count = 0;
    return;
  }

  const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  this.ratings.average = totalRating / this.reviews.length;
  this.ratings.count = this.reviews.length;
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
