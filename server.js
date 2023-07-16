const express = require('express');
const bcrypt = require('bcrypt-nodejs');
const cors = require('cors');
const knex = require('knex');

const db = knex({
    client: 'pg',
    connection: {
        host: '127.0.0.1',
        user: 'postgres',
        password: 'test',
        database: 'smartbrain'
    }
});

const app = express();

app.use(express.json());
app.use(cors());

app.post('/signin', (req,res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json('incorrect form submission');
    }
    
    db.select('email', 'hash').from('login')
    .where('email', '=', email)
    .then(data => {
        const isValid = bcrypt.compareSync(req.body.password, data[0].hash);
        if (isValid) {
            return db.select('*').from('users')
            .where('email', '=', email)
            .then(user => {
                res.json(user[0]);
            })
            .catch(err => res.status(400).json('unable to get user'));
        }
        else {
            res.status(400).json('wrong credentials');
        }
    })
    .catch(err => res.status(400).json('wrong credentials'));
});

app.get('/profile/:id', (req, res) => {
    const { id } = req.params;
    db.select('*').from('users').where({id: id}).then(user => {
        if (user.length) {
            res.json(user[0]);
        } else {
            res.status(400).json('not found');
        }
    })
    .catch(err => res.status(400).json('error getting user'));
});

app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    
    if (!email || !name || !password) {
        return res.status(400).json('incorrect form submission');
    }
    
    const hash = bcrypt.hashSync(password);

    db.transaction(trx => {
        trx.insert({
            hash: hash,
            email: email
        })
        .into('login')
        .returning('email')
        .then(loginemail => {
            return trx('users')
            .returning('*')
            .insert({
                email: loginemail[0].email,
                name: name,
                joined: new Date()
            })
            .then(user => {
                res.json(user[0]);
            });
        })
        .then(trx.commit)
        .catch(trx.rollback);
    })
    .catch(err => res.status(400).json('unable to register'));
});

app.put('/image', (req, res) => {
    const { id } = req.body;
    db('users').where('id', '=', id)
    .increment('entries', 1)
    .returning('entries')
    .then(entries => {
        res.json(entries[0].entries);
    })
    .catch(err => res.status(400).json('unable to get entries'));
});

app.post('/imageurl', (req, res) => {
    fetch("https://api.clarifai.com/v2/models/face-detection/outputs", returnClarifaiRequestOptions(req.body.input))
    .then(response => res.json(response))
    .then(response => console.log(response.json()))
    .catch(err => res.status(400).json('unable to work with API'));
});

const returnClarifaiRequestOptions = (imageUrl) => {
    
    // Your PAT (Personal Access Token) can be found in the portal under Authentification
    const PAT = '381fb3e3ac09431d8dd7144bfc46a05d';
    // Specify the correct user_id/app_id pairings
    // Since you're making inferences outside your app's scope
    const USER_ID = 'km1984';       
    const APP_ID = 'test';
    
    const IMAGE_URL = imageUrl;

    const raw = JSON.stringify({
        "user_app_id": {
            "user_id": USER_ID,
            "app_id": APP_ID
        },
        "inputs": [
            {
                "data": {
                    "image": {
                        "url": IMAGE_URL
                    }
                }
            }
        ]
    });

    const requestOptions = {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Key ' + PAT
        },
        body: raw
    };

    return requestOptions;
}

app.listen(3001, () => {
    console.log('app is running on port 3001');
});