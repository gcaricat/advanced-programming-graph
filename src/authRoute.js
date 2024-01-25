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
        console.log("\nResponse: \n:", response.account);
        req.session.isLoggedIn = true;
        req.session.userId = response.account.homeAccountId;
        req.session.accessToken = response.accessToken;
        req.session.username = response.account.preferred_username;
        req.session.name = response.account.name;
        req.session.email = response.idTokenClaims.email;

        res.redirect('/dashboard');
    }).catch(error => {
        console.error(error);
        res.status(500).send("Error acquiring token");
    });

})

router.get('/dashboard', async (req, res) => {

    if (!req.session.isLoggedIn) {
        res.redirect('/login')
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
             .top(10) // Get the top 10 emails
             .select('subject,from,receivedDateTime,bodyPreview')
             .orderby('receivedDateTime DESC')
             .get();

         const nextLink = result['@odata.nextLink'];

         res.render('dashboard', {
             emails: result.value,
             currentFolder: emailFolder,
             currentUserName: req.session.name,
             currentEmail: req.session.email,
             isCurrentFolder: isCurrentFolder,
             nextLink: nextLink,
             formatDisplayDateTimeList: formatDisplayDateTimeList
         });
     } catch (error) {
         res.render('dashboard', {
             emails: [],
             currentFolder: emailFolder,
             username: req.session.username,
             currentUserName: req.session.name,
             currentEmail: req.session.email,
             isCurrentFolder: isCurrentFolder,
             formatDisplayDateTimeList: formatDisplayDateTimeList
         });
    }
});

router.get('/load-more-emails', async (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).send('Unauthorized');
    }

    let nextLink = req.query.nextLink;
    nextLink = nextLink.replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");

    const client = graph.Client.init({
        authProvider: (done) => {
            done(null, req.session.accessToken); // Provide the access token here
        }
    });

    try {
        const result = await client
            .api(nextLink) // Use the nextLink to fetch more emails
            .get();

        result.value.forEach(email => {
            email.formattedDateTime = formatDisplayDateTimeList(email.receivedDateTime);
        });

        res.json({
            emails: result.value,
            nextLink: result['@odata.nextLink']
        });
    } catch (error) {
        res.status(500).send('Error loading more emails');
    }
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

router.get('/', async (req, res) => {
    if (!req.session.isLoggedIn) {
        res.redirect('login');
        return;
    }
    res.redirect('dashboard');
    return;
});

function isCurrentFolder(folderPrimary, currentFolder) {
    return currentFolder === folderPrimary ? 'active' : '';
}

function formatDisplayDateTimeList(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    if (date > oneMonthAgo) {
        // Format as 'dayName dayNumber'
        return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    } else {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });
    }
}

module.exports = router;