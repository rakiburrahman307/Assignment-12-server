const express = require('express');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const jwt = require('jsonwebtoken');
var cookieParser = require('cookie-parser')
const app = express();
const port = process.env.PORT || 5000;


// Middle Ware
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5000'],
    credentials: true,
}));

app.use(cookieParser());
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
});


// Middle Ware api


const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' })
    } else {
        jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
            if (err) {
                return res.status(err).send({ message: 'Unauthorized access' });
            } else {
                req.user = decoded;
                next();
            }
        });

    }
};



const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.044ysfk.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // Database and Collection 
        const mealsCollections = client.db('hostel_management').collection('all_meals');
        const upcomingMealsCollections = client.db('hostel_management').collection('upcoming');
        const userCollections = client.db('hostel_management').collection('users');
        const paymentType = client.db('hostel_management').collection('payment_type');
        const perchesPlanUsers = client.db('hostel_management').collection('perches_Plan_Users');
        const requestMealsCollections = client.db('hostel_management').collection('request_meals');



        // Authentication related api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '2h' })

            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'none'
                })
                .send({ success: true });
        });


        app.post('/logout', async (req, res) => {
            const user = req.body;
            res
                .clearCookie('token', { maxAge: 0 })
                .send({ success: true });
        })

        // admin related api middlewares
        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req?.user?.email;
            const query = { email: email };
            const user = await userCollections.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }
        // checking user admin or not 
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req?.user?.email) {
                return res.status(403).send({ message: 'forbidden access' })
            } else {
                const query = { email: email };
                const user = await userCollections.findOne(query);
                let admin = false;
                if (user) {
                    admin = user?.role === 'admin';
                }
                res.send({ admin });
            }
        })

        // Service Apis 
        // Get the all Of meals 
        app.get('/all_meals', async (req, res) => {
            const cursor = mealsCollections.find();
            const result = await cursor.toArray();
            res.send(result);
        });
        app.get('/all_meals/pagination', async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            const cursor = mealsCollections.find()
                .skip(page * size)
                .limit(size)
            const result = await cursor.toArray();
            res.send(result);
        });
        app.get('/all_meals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await mealsCollections.findOne(query);
            res.send(result);
        });
        app.get('/all_meals_count', async (req, res) => {
            const count = await mealsCollections.estimatedDocumentCount();
            res.send({ count });
        });

        app.post('/all_meals_review/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const reviewData = req.body;
            const result = await mealsCollections.updateOne(query, {
                $push: { reviews: reviewData },
            });
            res.send(result);
        });
        app.get('/all_meals/:id/reviews', async (req, res) => {
            const mealId = req.params.id;
            const meal = await mealsCollections.findOne({ _id: new ObjectId(mealId) });
            if (!meal) {
                return res.status(404).send({ message: 'Meal not found' });
            }
            const reviews = meal.reviews || [];
            res.send(reviews);
        });
        app.get('/all_meals/:id/reviewConfirm/:email', async (req, res) => {
            const mealId = req.params.id;
            const email = req.params.email;
            const meal = await mealsCollections.findOne({ _id: new ObjectId(mealId) });
            if (!meal) {
                return res.status(404).send({ message: 'Meal not found' });
            }
            const reviews = meal.reviews || [];
            const reviewExists = reviews.some((review) => review.email === email);
            res.send({ reviewExists });
        });
        app.post('/all_meals/:id/like', async (req, res) => {
            const mealId = req.params.id;
        
            try {
                const meal = await mealsCollections.findOne({ _id: new ObjectId(mealId) });
        
                if (!meal) {
                    return res.status(404).send({ message: 'Meal not found' });
                }
                const updatedLikes = meal.likes + 1;
                await mealsCollections.updateOne({ _id: new ObjectId(mealId) }, { $set: { likes: updatedLikes } });
                res.send({ success: true });
            } catch (error) {
                console.error('Error updating like count in the database:', error);
                res.status(500).send({ message: 'Internal server error' });
            }
        });
        // upcomingMeals related api 
        app.get('/upcoming', verifyToken, async (req, res) => {
            const cursor = upcomingMealsCollections.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        app.post('/upcoming', async (req, res) => {
            const cursor = upcomingMealsCollections.find();
            const result = await cursor.toArray();
            res.send(result);
        });
        // user data post api 
        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const result = await userCollections.insertOne(newUser)
            res.send(result);
        });
        app.patch('/users', async (req, res) => {
            const newUser = req.body;
            const result = await userCollections.insertOne(newUser)
            res.send(result);
        });
        // plans related api
        app.get('/plans', async (req, res) => {
            const cursor = paymentType.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get('/plans/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await paymentType.findOne(query);
            res.send(result);
        });
        //  perches plans user apis 
        app.get('/parchesPlan', async (req, res) => {
            const cursor = perchesPlanUsers.find();
            const result = await cursor.toArray();
            res.send(result);
        });
        app.post('/confirmPlans', async (req, res) => {
            const newUser = req.body;
            const result = await perchesPlanUsers.insertOne(newUser)
            res.send(result);
        });
        app.get('/plansConfirm/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await perchesPlanUsers.findOne(query);
            res.send(result);
        });
        //   payment related apis 
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'amount inside the intent')

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });

        // request for the meals api 
        app.post('/req_meal', async (req, res) => {
            const newRequest = req.body;
            const result = await requestMealsCollections.insertOne(newRequest)
            res.send(result);
        });

        // using jwt to secure 1 api
        // Get the my Jobs  and Secure the api 
        app.get('/my_jobs', verifyToken, async (req, res) => {
            if (req?.query?.email !== req?.user?.email) {
                return res.status(403).send({ message: 'Forbidden access' });

            } else {
                let query = {};
                if (req.query?.email) {
                    query = { jobPost: req?.query?.email }
                }
                const cursor = jobsCollections.find(query);
                const result = await cursor.toArray();
                res.send(result);
            }

        });



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send("Server Is Running Hot!")

});
app.listen(port, () => {
    console.log(`Server is running port: ${port}`)
});

