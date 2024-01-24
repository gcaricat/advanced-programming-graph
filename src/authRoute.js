const express = require('express');
const router = express.Router();
const msal = require('@azure/msal-node');
const graph = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const {response} = require("express");

router.get('/config', (req, res) => {
    res.json({
        tenantId: process.env.TENANT,
        clientId: process.env.CLIENT_ID,
        redirectUri: process.env.REDIRECT_URI,
        scope: process.env.SCOPE,
    });
});



const msalConfig = {
  auth: {
      clientId: process.env.CLIENT_ID,
      authority: `https://login.microsoftonline.com/${process.env.TENANT}`,
      clientSecret: process.env.CLIENT_SECRET
  }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);



router.get('/auth', async (req, res) => {

    const authCode = req.query.code;
    console.log(authCode)

    if (!authCode) {
        res.send("No authorization code received.");
        return;
    }

    const tokenRequest = {
        code: authCode,
        scope: encodeURI(process.env.SCOPE.split(' ')),
        redirectUri: process.env.REDIRECT_URI,
    };

    cca.acquireTokenByCode(tokenRequest).then(response => {
        console.log("\nResponse: \n:", response);
        req.session.isLoggedIn = true;
        req.session.userId = response.account.homeAccountId;
        req.session.accessToken = response.accessToken;

        res.redirect('/dashboard');
        //res.status(200).json(response);
    }).catch(error => {
        console.error(error);
        res.status(500).send("Error acquiring token");
    });


})

router.get('/dashboard', async (req, res) => {
    if (!req.session.isLoggedIn) {
        res.redirect('/login')
        //res.render('login')
        //res.send("Access denied. Please login first");
        return;
    }

    const emailFolder = req.query.folder || 'inbox';
    const emailFolderPath = `/me/mailFolders/${emailFolder}/messages`;

    const client = graph.Client.init({
        authProvider: (done) => {
            done(null, req.session.accessToken); // Provide the access token here
        }
    });

     try {
         // Fetch emails from the user's mailbox
         const result = await client
             .api(emailFolderPath)
             .top(20) // Get the top 10 emails for example
             .select('subject,from,receivedDateTime,bodyPreview')
             .orderby('receivedDateTime DESC')
             .get();
         //console.log(result.value)
         res.render('dashboard', {
             emails: result.value,
             currentFolder: emailFolder,
             username: req.session.username
         });
     } catch (error) {
         console.error(error);
         res.render('dashboard', {
             emails: [],
             currentFolder: emailFolder,
             username: req.session.username
         });
         //res.status(500).send("Error fetching emails");
    }

    // res.render(
    //     'dashboard',
    //     {username: req.session.username}
    // )
});

router.get('/login', async (req, res) => {
    if (!req.session.isLoggedIn) {
        res.render('login');
        return;
    }

    res.reload('dashboard');
    return;
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/'); // or to login page
});

router.get('/', async (req, res) => {
    if (!req.session.isLoggedIn) {
        res.redirect('login');
        return;
    }

    res.redirect('dashboard');
    return;
});

router.get('/fetch-email/:emailId', async (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).send('Unauthorized');
    }

    const emailId = req.params.emailId;
    const accessToken = req.session.accessToken;

    const client = graph.Client.init({
        authProvider: (done) => {
            done(null, accessToken);
        }
    });

    try {
        const emailDetails = await client
            .api(`/me/messages/${emailId}`)
            .get();

        res.json(emailDetails);
    } catch (error) {
        console.error('Error fetching email details:', error);
        res.status(500).send('Error fetching email details');
    }
});


/*


router.get('/auth', (req, res) => {
   const authCode = req.query.code;

   if (!authCode) {
       res.send("No authorization code received.");
       return;
   }

    console.log("Authorization Code:", authCode);
    res.send("Authorization Code received, proceed to exchange it for a token.");

});

*/

module.exports = router;