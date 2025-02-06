const Product = require('../models/Product');
const { uploadToS3, deleteFromS3 } = require('../utils/s3');

// Get all products with filtering and pagination
exports.getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      subCategory,
      brand,
      minPrice,
      maxPrice,
      sort,
      search
    } = req.query;

    // Build query
    const query = {};
    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;
    if (brand) query.brand = brand;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort options
    let sortOptions = {};
    if (sort) {
      switch (sort) {
        case 'price_asc':
          sortOptions.price = 1;
          break;
        case 'price_desc':
          sortOptions.price = -1;
          break;
        case 'newest':
          sortOptions.createdAt = -1;
          break;
        case 'rating':
          sortOptions['ratings.average'] = -1;
          break;
        default:
          sortOptions.searchScore = -1;
      }
    }

    // Execute query with pagination
    const products = await Product.find(query)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('seller', 'name');

    // Get total count
    const total = await Product.countDocuments(query);

    res.json({
      status: 'success',
      data: {
        products,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get single product
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name')
      .populate('reviews.user', 'name avatar');

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    res.json({
      status: 'success',
      data: { product }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Create product
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      comparePrice,
      category,
      subCategory,
      brand,
      variants,
      specifications,
      tags
    } = req.body;

    // Handle image uploads
    const images = [];
    if (req.files) {
      for (const file of req.files) {
        const result = await uploadToS3(file);
        images.push({
          url: result.Location,
          alt: name
        });
      }
    }

    const product = new Product({
      name,
      description,
      price,
      comparePrice,
      category,
      subCategory,
      brand,
      seller: req.user._id,
      images,
      variants,
      specifications,
      tags
    });

    await product.save();

    res.status(201).json({
      status: 'success',
      data: { product }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    // Check if user is the seller
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update this product'
      });
    }

    // Handle image uploads if any
    if (req.files) {
      // Delete old images from S3
      for (const image of product.images) {
        await deleteFromS3(image.url);
      }

      // Upload new images
      const images = [];
      for (const file of req.files) {
        const result = await uploadToS3(file);
        images.push({
          url: result.Location,
          alt: req.body.name || product.name
        });
      }
      req.body.images = images;
    }

    // Update product
    Object.assign(product, req.body);
    await product.save();

    res.json({
      status: 'success',
      data: { product }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    // Check if user is the seller
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this product'
      });
    }

    // Delete images from S3
    for (const image of product.images) {
      await deleteFromS3(image.url);
    }

    await product.remove();

    res.json({
      status: 'success',
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Add review
exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    // Check if user already reviewed
    const existingReview = product.reviews.find(
      review => review.user.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        status: 'error',
        message: 'You have already reviewed this product'
      });
    }

    // Handle review images if any
    const images = [];
    if (req.files) {
      for (const file of req.files) {
        const result = await uploadToS3(file);
        images.push(result.Location);
      }
    }

    // Add review
    product.reviews.push({
      user: req.user._id,
      rating,
      comment,
      images
    });

    // Update average rating
    product.updateAverageRating();
    await product.save();

    res.json({
      status: 'success',
      data: { product }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
