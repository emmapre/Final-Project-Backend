import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import crypto from 'crypto'
import bcrypt from 'bcrypt-nodejs'
import layersData from './data/layers.json'


const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/cakeMaker"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise



//Layer model
const Layer = mongoose.model('Layer', {
  name: {
    type: String
  },
  ingredients: [
    {
      ingredientName: {
        type: String,
      },
      ingredientColor: {
        type: String,
      }
    }
  ]
})

//CakeOrder model
const CakeOrder = mongoose.model('CakeOrder', {
  chosenIngredients: {
    type: Array,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
})


const User = mongoose.model('User', {
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
    minlength: 4
  },
  // adress: {
  //   type: String,
  //   required: true
  // },
  // phoneNumber: {
  //   type: String,
  //   required: true
  // },
  // pay: {
  //   type: String,
  //   required: true
  // },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  },
  orderedCakes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CakeOrder'
  }],
})

if (process.env.RESET_DB) {
  console.log('Resetting database.')

  const seedDatabase = async () => {
    await Layer.deleteMany()

    await layersData.forEach(layer => new Layer(layer).save())
  }
  seedDatabase()
}

const authenticateUser = async (req, res, next) => {
  try {
    const user = await User.findOne({
      accessToken: req.header('Authorization')
    })
    if (user) {
      req.user = user
      next()
    } else {
      res
        .status(401)
        .json({ loggedOut: true, message: 'Please try logging in again' })
    }
  } catch (err) {
    res
      .status(403)
      .json({ message: 'Access token is missing or wrong', errors: err })
  }
}

// Defines the port the app will run on. Defaults to 8080, but can be 
// overridden when starting the server. For example:
//
//   PORT=9000 npm start
const port = process.env.PORT || 8087
const app = express()

const listEndpoints = require('express-list-endpoints')

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

// Start defining your routes here
app.get('/', (req, res) => {
  res.send(listEndpoints(app))
})

//LAYERS ENDPOINT
app.get('/layers', async (req, res) => {
  try {
    const layers = await Layer.find()
    res.status(200).json(layers)
  } catch (err) {
    res.status(404).json({
      message: `No results`,
      errors: err.error
    })
  }
})

//USER ENDPOINTS
//signup endpoint
app.post('/users', async (req, res) => {
  try {
    const { name, email, password } = req.body
    const user = new User({ name, email, password: bcrypt.hashSync(password) })
    const newUser = await user.save()
    res.status(201).json({
      message: 'User created.',
      userId: newUser._id,
      accessToken: newUser.accessToken
    })
  } catch (err) {
    res.status(400).json({
      message: 'Could not create user.',
      errors: err.errors
    })
  }
})

//To get a list of users (not sure I'll need this for other than testing)
app.get('/users', async (req, res) => {
  const users = await User.find()
    .sort({ createdAt: 'desc' })
    .populate('orderedCakes')
    .limit(20)
    .exec()
  res.json(users)
})

//To get one single user
app.get('users/userId', authenticateUser)
app.get('/users/:userId', async (req, res) => {
  res.status(201).json({ email: req.user.email, userId: req.user._id })


  // const { userId } = req.params
  // try {
  //   const user = await User.findOne({ _id: userId })
  //     .populate('orderedCakes')
  //   res.status(200).json(user)
  // } catch (err) {
  //   res.status(400).json({ error: 'Could not find user.', errors: err.errors });
  // }
})



//Sign in endpoint
app.post('/sessions', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email: req.body.email })
    if (user && bcrypt.compareSync(req.body.password, user.password)) {
      res.status(201).json({ userId: user._id, accessToken: user.accessToken })
    } else {
      res.status(404).json({ notFound: true })
    }
  } catch (err) {
    res.status(404).json({ notFound: true })
  }
})


//cakeendpoinsen med login måste ligga under sessions eftersom man måste ha login för att kunna komma åt dem.
//POST to cakeorder

app.post('/cakeorders', authenticateUser)
app.post('/cakeorders', async (req, res) => {
  const {
    chosenIngredients,
    userId
  } = req.body

  try {
    const cakeOrder = await new CakeOrder(req.body).save()

    await User.findOneAndUpdate(
      { _id: userId },
      { $push: { orderedCakes: cakeOrder._id } }
    )
    res.status(201).json(order)
  } catch (err) {
    res.status(400).json({
      message: 'Could not place order',
      errors: err.errors
    })
  }
})

//CAKEORDER ENDPOINTS
//GET all cake orders
app.get('/cakeorders', async (req, res) => {

  try {
    const cakeOrders = await CakeOrder.find()
      .sort({ createdAt: 'desc' })
      .populate('userId')
      .limit(20)
      .exec()
    res.json(cakeOrders)
  } catch (err) {
    res.status(404).json({
      message: 'Could not find any cake orders',
      errors: err.error
    })
  }
})

app.get('/users/:userId', authenticateUser)
app.get('/users/:userId', async (req, res) => {
  const { userId } = req.params

  try {
    const user = await User.findOne({ _id: userId })
      .populate({
        path: 'orderHistory',
        select: 'items createdAt status',
        populate: {
          path: 'items',
          select: 'name price'
        }
      })
      .populate({
        path: 'products',
        select: 'name description createdAt sold'
      })

    res.status(200).json(user)
  } catch (err) {
    res.status(400).json({
      message: ERR_INVALID_REQUEST,
      errors: err.errors
    })
  }
})






//GET one specific cake order
app.post('/cakeorders/:cakeOrderId', authenticateUser)
app.get('/cakeorders/:cakeOrderId', async (req, res) => {
  const { cakeOrderId } = req.params
  try {
    const cakeOrder = await CakeOrder.findOne({ _id: cakeOrderId })
    res.status(200).json(cakeOrder)
  } catch (err) {
    res.status(400).json({
      message: 'Could not find cake order.',
      errors: err.errors
    });
  }
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})