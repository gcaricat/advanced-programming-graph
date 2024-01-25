require('dotenv').config()
const express = require('express')
const session = require('express-session');
const app = express()

app.use(session({
    secret: '123',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: 'auto' }
}));

const authRoute = require('./authRoute'); // Import the router
const PORT = process.env.PORT || 3000
const clientId = process.env.CLIENT_ID;
const router = express.Router();

app.use('/', authRoute); // Use the router
app.set('view engine', 'ejs'); // Set the view engine to EJS
app.set('views', 'views'); // Set the views directory

router.get('/config', (req, res) => {
    res.json({
        tenantId: process.env.TENANT_ID,
        clientId: process.env.CLIENT_ID,
        redirectUri: process.env.REDIRECT_URI,
        scope: process.env.SCOPE,
    });
});

app.use(express.static('public'));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));