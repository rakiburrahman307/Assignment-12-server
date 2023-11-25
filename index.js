const express = require('express');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
var cookieParser = require('cookie-parser')
const app = express();
const port = process.env.PORT || 5000;


// Middle Ware
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5173'],
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
        })

        app.post('/logout', async (req, res) => {
            const user = req.body;
            res
                .clearCookie('token', { maxAge: 0 })
                .send({ success: true });
        })
        // Service Apis 
        // Get the all Of meals 
        app.get('/all_meals',async (req, res) => {
            const cursor = mealsCollections.find();
            const result = await cursor.toArray();
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
        // Post a new Jobs 
        app.post('/all_jobs',verifyToken, async (req, res) => {
            const newJobs = req.body;
            const result = await jobsCollections.insertOne(newJobs)
            res.send(result);
        });
        // Update data api
        app.patch('/all_jobs/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    jobTitle: data.jobTitle,
                    formatStartDate: data.formatStartDate,
                    formatEndDate: data.formatEndDate,
                    salary: data.salary,
                    imageUrl: data.photoURL,


                }
            };
            const result = await jobsCollections.updateOne(query, updateDoc);
            res.send(result);
        });
        // Delete data 
        app.delete('/all_Jobs/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobsCollections.deleteOne(query);
            res.send(result);
        });
        // Get job by Id 
        app.get('/all_jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobsCollections.findOne(query);
            res.send(result);
        });
        //   $inc implement here 
        app.put('/update_count/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $inc: { applicantsNumber: 1 },
            };
            const options = { new: true };
            const result = await jobsCollections.findOneAndUpdate(query, updateDoc, options);
            res.send(result);
        });

        // using jwt to secure 2 api
        //   Get the all applied job collection Ans Secure api
        app.get('/applied_job', verifyToken, async (req, res) => {
            if (req?.query?.email !== req?.user?.email) {
                return res.status(403).send({ message: 'Forbidden access' });

            } else {
                let query = {};
                if (req.query?.email) {
                    query = { applyUserEmail: req?.query?.email }
                }
                const cursor = appliedJobsCollections.find(query);
                const result = await cursor.toArray();
                res.send(result);
            }

        });
        // Post all the applied job here 
        app.post('/applied_job', verifyToken, async (req, res) => {
            const newApplied = req.body;
            const result = await appliedJobsCollections.insertOne(newApplied)
            res.send(result);
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

