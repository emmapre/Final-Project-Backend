import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import crypto from 'crypto'
import bcrypt from 'bcrypt-nodejs'


const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/cakeMaker"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

//CakeOrder model
const CakeOrder = mongoose.model('CakeOrder', {
  cakeName: {
    type: String,
    required: true,
    minlength: 5
  },
  topping: {
    type: String,
    required: true,
  },
  cover: {
    type: String,
    required: true,
  },
  layer1: {
    type: String,
    required: true,
  },
  layer2: {
    type: String,
    required: true,
  },
  sponge: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  orderedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
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
  //INGEN ANING HUR JAG SKA LÄGGA IN DET HÄR
  // orderedCakes: [{
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'CakeOrder'
  // }],
})


const authenticateUser = async (req, res, next) => {
  const user = await User.findOne({ accessToken: req.header('Authorization') })
  if (user) {
    req.user = user
    next()
  } else {
    res.status(401).json({ loggedOut: true })
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
    .limit(20)
    .exec()
  res.json(users)
})

//To get one single user
app.get('/users/:userId', async (req, res) => {
  const { userId } = req.params
  try {
    const user = await User.findOne({ _id: userId })
      .populate('orderedCakes')
    res.status(200).json(user)
  } catch (err) {
    res.status(400).json({ error: 'Could not find user.', errors: err.errors });
  }
})



//Sign in endpoint
app.post('/sessions', async (req, res) => {
  const user = await User.findOne({ email: req.body.email })
  if (user && bcrypt.compareSync(req.body.password, user.password)) {
    res.json({ userId: user._id, accessToken: user.accessToken })
  } else {
    res.status(400).json({ notFound: true })
  }
})

// app.get('/secrets', authenticateUser)
// app.get('/secrets', (req, res) => {
//   res.json({ secret: 'This is a super secret message.' })
// })


//cakeendpoinsen med login måste ligga under sessions eftersom man måste ha login för att kunna komma åt dem.
//CAKEORDER ENDPOINTS
//GET all cake orders
app.get('/cakeorders', async (req, res) => {
  try {
    const cakeOrders = await CakeOrder.find()
      .sort({ createdAt: 'desc' })
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

//POST to cakeorder
app.post('/cakeorders', authenticateUser)
app.post('/cakeorders', async (req, res) => {
  const { cakeName, topping, cover, layer1, layer2, sponge } = req.body
  const cakeOrder = new CakeOrder({ cakeName, topping, cover, layer1, layer2, sponge })
  try {
    const savedCakeOrder = await cakeOrder.save()
      .populate('orderedBy')
    res.status(201).json(savedCakeOrder)
  } catch (err) {
    res.status(400).json({ message: 'Could not save the cake order', error: err.errors })
  }
})




// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})




// {
// 	"cakeName":"Emmas cool cake",
// 	"topping":"strawberries",
// 	"cover":"cream",
// 	"layer1":"custard",
// 	"layer2":"jam",
// 	"sponge":"vanilla"
// }


// {
// 	"name": "Emma",
// 	"email": "emma@emma.se",
// 	"password": "emmaemma"
// }