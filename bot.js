import {Client, Intents, Collection, MessageEmbed, MessageAttachment, DiscordAPIError} from 'discord.js';
import require from 'dotenv/config';
import fetch from 'node-fetch';
import { promises as fs } from "fs";
import puppeteer from 'puppeteer';
import { get } from 'http';
import retry from 'async-retry';
const botToken = process.env.BOT_TOKEN;


const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });



/* Ready */
bot.on("ready", () => {
    console.log("The bot is ready");



    bot.channels.fetch(process.env.CHANNEL_ID).then(channel => {




        // MAKE THE TRANSACTION MESSAGES

        var apiLink = "https://api.ethplorer.io/getTokenHistory/"+ process.env.CONTRACT_TOKEN +"?apiKey=" + process.env.ETHPLORER_API_KEY;
        var transactionsInterval = setInterval (function () {

            async function getDataToPost() {
                var data = await retry(
                    async (bail) => {
                        const response = await fetch(apiLink);

                        if (403 === response.status) {
                            bail(new Error('Unauthorized'));
                            return;
                        }

                        const data = await response.json();

                        return data;
                    },
                    {
                        retries: 5,
                        minTimeout: 5000,
                    }
                );

                async function readData(){
                    let dataX = fs.readFile('transactions.json', "utf8", function (err, data) {
                        return data;
                    });

                    return dataX;

                }

                var dataFromFile = await readData();
                dataFromFile = JSON.parse(dataFromFile);




                data.operations.forEach(element => {


                    var elementData = {
                        timestamp : element.timestamp,
                        transactionHash : element.transactionHash,
                        transactionValue : element.value,
                        from : element.from,
                        to : element.to,
                        holders : element.tokenInfo.holdersCount
                    }




                    if(!dataFromFile.some(transaction => transaction.transactionHash === element.transactionHash)){
                        dataFromFile.push(elementData);


                        console.log(elementData);
                        console.log(".................");



                        function timeConverter(UNIX_timestamp){
                            var a = new Date(UNIX_timestamp * 1000);
                            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                            var year = a.getFullYear();
                            var month = months[a.getMonth()];
                            var date = a.getDate();
                            var hour = a.getHours();
                            var min = a.getMinutes();
                            if (min < 10) {
                                min.toString();
                                min = "0" + min;
                            };
                            var sec = a.getSeconds();
                            if (sec < 10) {
                                sec.toString();
                                sec = "0" + sec;
                            };
                            var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
                            return time;
                          }


                        var gmt = timeConverter(element.timestamp);

                        var transactionFrom = element.from;
                        var transactionTo = element.to;

                        // Color Green - #8cd96b
                        // Color Red - #ff5959
                        // Color Blue - #0093ba

                        // Green Arrow Link - https://i.imgur.com/LG7KB5D.png
                        // Red Arrow Link - https://i.imgur.com/weeLdZc.png
                        // Blue Transaction - https://i.imgur.com/fjgrMbK.png

                        if(element.from == process.env.UNISWAP_ADDRESS){
                            var transfer = false;
                            var messageColor = "#8cd96b";
                            var arrowColor = "https://i.imgur.com/LG7KB5D.png";
                            transactionFrom = "Uniswap CYBR Pool";

                        }else if (element.to == process.env.UNISWAP_ADDRESS){
                            var transfer = false;
                            var messageColor = "#ff5959";
                            var arrowColor = "https://i.imgur.com/weeLdZc.png";
                            transactionTo = "Uniswap CYBR Pool";
                        }else{
                            var transfer = true;
                            var messageColor = "#0093ba";
                            var arrowColor = "https://i.imgur.com/fjgrMbK.png";
                        }



                        // Calculate Quantity

                        var tokenQuantity = element.value.toString();
                        tokenQuantity = tokenQuantity.slice(0, -18);
                        tokenQuantity = tokenQuantity.replace(/\B(?=(\d{3})+(?!\d))/g, ",");



                        // SEND THE DISCORD MESSAGE

                        if (transfer == false) {
                        const messageToBeSent = new MessageEmbed()
                        .setColor(messageColor)
                        .setTitle('Check Transaction on EtherScan.io!')
                        .setURL('https://etherscan.io/tx/' + element.transactionHash)
                        .setAuthor('www.TheCyberEnterprise.com', 'https://i.imgur.com/oDZJsgu.png', 'https://thecyberenterprise.com/')
                        .setDescription(':eyes: :eyes: :eyes: WE SEE YOU!! :eyes: :eyes: :eyes:')
                        .setThumbnail(arrowColor)
                        .addField('Tokens Quantity', tokenQuantity)
                        .addField('From', transactionFrom)
                        .addField('To', transactionTo)
                        .addField('GMT Timestamp', gmt)
                        .addField('Check out more information on Dextools.io!', "[Dextools](https://www.dextools.io/app/ether/pair-explorer/0x4bbd1ddc2ded3c287b74dbf3c2e500631de4bf50)")
                        .setFooter('The Cyber Team', 'https://i.imgur.com/oDZJsgu.png');

                        channel.send({ embeds: [messageToBeSent] });
                        }
                    }


                });

                fs.writeFile("transactions.json", JSON.stringify(dataFromFile), function(err){
                    if (err) throw err;
                    console.log('The "data to append" was appended to file!');
                });
                



            }
        
            try {
                getDataToPost();
            } catch (err) {
                console.log("Transaction error: ", err);
            }

        }, process.env.SECONDS * 1000); 
    });


    bot.channels.fetch(process.env.PRICE_CHANNEL_ID).then(channel => {    

        // MAKE THE REMINDER MESSAGES
        var remindersInterval = setInterval (function () {
            async function makeReminder() {

                async function readData(){
                    let dataX = fs.readFile('reminder.json', "utf8", function (err, data) {
                        return data;
                    });

                    return dataX;

                }

                var dataFromFile = await readData();
                dataFromFile = JSON.parse(dataFromFile);

                var writeFile = false;

                if(typeof(dataFromFile[0].lastReminder) !== 'undefined'){
                    var timeSinceLastReminder = Date.now() - dataFromFile[0].lastReminder;

                    // time to wait in hours
                    var waitingHours = 24;
                    var timeToWait = waitingHours * 60 * 60 * 1000;


                    if(timeSinceLastReminder > timeToWait){
                        

                       // SEND THE DISCORD MESSAGE

                        const messageToBeSent = new MessageEmbed()
                        .setColor('#655dff')
                        .setTitle('Friendly reminder')
                        .setAuthor('www.TheCyberEnterprise.com', 'https://i.imgur.com/oDZJsgu.png', 'https://thecyberenterprise.com/')
                        .setDescription('Hey guys! Just a friendly reminder once every 24 hours with some of the tasks anyone can do for the CYBR project.')
                        .addField('General Upvote Links:',
                            '[Blockfolio](https://feedback.blockfolio.com/coin-requests/p/httpswwwthecyberenterprisecom)\n' +
                            '[CoinAlpha](https://coinalpha.app/token/0x438a6E42813118548C065336844239b63ad4Fcfd)\n' +
                            '[CoinDiscover](https://coindiscovery.app/coin/cyber)\n' +
                            '[CoinHunt](https://coinhunt.cc/coin/529477220)\n' +
                            '[CoinHunters](https://coinhunters.cc/tokens/Cyber)\n' +
                            '[CoinMooner](https://coinmooner.com/coin/13424)\n' +
                            '[Coinscope](https://www.coinscope.co/coin/1-cybr#login&vote)\n' +
                            '[CoinSniper](https://coinsniper.net/coin/27671)\n' +
                            '[CoinVote](https://coinvote.cc/coin/Cyber)\n' +
                            '[FreshCoins](https://www.freshcoins.io/coins/cyber)\n' +
                            '[RugFreeCoins](https://www.rugfreecoins.com/details/8084)'
                        )

                        .addField('Reddit Upvote Links:',
                            '[tdietz20](https://www.reddit.com/u/tdietz20/)\n [Aldo-Bass](https://www.reddit.com/user/Aldo-Bass/)\n [Far_Wish_4891](https://www.reddit.com/user/Far_Wish_4891/)\n'
                        )

                        .addField('Medium Claps:',
                            '[@TheCyberEnterprise](https://thecyberenterprise.medium.com/)\n '
                        )

                        .setFooter('The Cyber Team', 'https://i.imgur.com/oDZJsgu.png');

                        channel.send({ embeds: [messageToBeSent] });




                        dataFromFile[0].lastReminder = Date.now();
                        writeFile = true;
                    }

                }else{
                    dataFromFile[0].lastReminder = Date.now();
                    writeFile = true;
                }



                if(writeFile == true){
                    fs.writeFile("reminder.json", JSON.stringify(dataFromFile), function(err){
                        if (err) throw err;
                        console.log('The "data to append" was appended to file!');
                    });
                }

            }

            try {
                makeReminder();
            } catch(err) {
                console.log("Reminder error: ", err);
            }

        }, 40 * 1000);  // 300 - each 5 minutes   
    });
});



// on message

bot.on('messageCreate', message => {
    if(!message.content.startsWith(process.env.BOT_PREFIX || message.author.bot)) return;

    const args = message.content.slice(process.env.BOT_PREFIX.length).split(/ + /);
    const command = args.shift().toLocaleLowerCase();

    if(command === 'hi'){
        message.channel.send("hi");
    }


    if(command === 'holders'){
        var apiLink = "https://api.ethplorer.io/getTokenInfo/"+ process.env.CONTRACT_TOKEN +"?apiKey=" + process.env.ETHPLORER_API_KEY;

        async function getDataToPost() {
            var apiResponse = await fetch(apiLink);
            var data = await apiResponse.json();


             // SEND THE DISCORD MESSAGE

             const messageToBeSent = new MessageEmbed()
             .setColor('#655dff')
             .setAuthor('www.TheCyberEnterprise.com', 'https://i.imgur.com/oDZJsgu.png', 'https://thecyberenterprise.com/')
             .setDescription('There are a total of ' + data.holdersCount + ' holders!')
             .addField('------------------------------------------------', ':eyes: :eyes: :eyes: WE SEE YOU ALL!! :eyes: :eyes: :eyes:')
             .setFooter('The Cyber Team', 'https://i.imgur.com/oDZJsgu.png');

            message.channel.send({ embeds: [messageToBeSent] });

        }

        try {
            if (message.channel == process.env.PRICE_CHANNEL_ID || message.channel == process.env.SPAM_CHANNEL_ID) {
            getDataToPost();
            } else {
                message.channel.send("Please send this command in the <#" + process.env.PRICE_CHANNEL_ID + "> or in <#" + process.env.SPAM_CHANNEL_ID + ">!")
            }
        } catch(err) {
            console.log("Data to post error", err);
        }
    }


    if(command === 'burned'){
        var apiLink = "https://api.ethplorer.io/getTokenInfo/"+ process.env.CONTRACT_TOKEN +"?apiKey=" + process.env.ETHPLORER_API_KEY;

        async function getDataToPost() {

            Number.prototype.countDecimals = function () {
                if(Math.floor(this.valueOf()) === this.valueOf()) return 0;
                return this.toString().split(".")[1].length || 0; 
            }


            var apiResponse = await fetch(apiLink);
            var data = await apiResponse.json();

            var initialTokens = 1000000000000000;

            var currentTokens = data.totalSupply;
            currentTokens = currentTokens.toString();
            currentTokens = currentTokens.slice(0, -18);
            currentTokens = parseInt(currentTokens);


            

            var burnedSoFar = initialTokens - currentTokens;





            burnedSoFar = burnedSoFar.toString();
            burnedSoFar = parseInt(burnedSoFar);


            var percentageBurned = burnedSoFar / initialTokens * 100;
            if(percentageBurned.countDecimals() > 5){
                percentageBurned = percentageBurned.toFixed(5);
            }
            

            // convert to strings and format
  
            initialTokens = initialTokens.toString();
            initialTokens = initialTokens.replace(/\B(?=(\d{3})+(?!\d))/g, ",");


            currentTokens = currentTokens.toString();
            currentTokens = currentTokens.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

            burnedSoFar = burnedSoFar.toString();
            burnedSoFar = burnedSoFar.replace(/\B(?=(\d{3})+(?!\d))/g, ",");



             // SEND THE DISCORD MESSAGE

             const messageToBeSent = new MessageEmbed()
             .setColor('#655dff')
             .setAuthor('www.TheCyberEnterprise.com', 'https://i.imgur.com/oDZJsgu.png', 'https://thecyberenterprise.com/')
             .addField('Initial Supply', initialTokens)
             .addField('Tokens In Circulation', currentTokens)
             .addField('Tokens Burned so Far', burnedSoFar)
             .addField('Tokens Burned so Far in %', percentageBurned + '%')
             .setFooter('The Cyber Team', 'https://i.imgur.com/oDZJsgu.png');

            message.channel.send({ embeds: [messageToBeSent] });

        }
        
        try {
            if (message.channel == process.env.PRICE_CHANNEL_ID || message.channel == process.env.SPAM_CHANNEL_ID) {
            getDataToPost();
            } else {
                message.channel.send("Please send this command in the <#" + process.env.PRICE_CHANNEL_ID + "> or in <#" + process.env.SPAM_CHANNEL_ID + ">!")
            }
        } catch(err) {
            console.log("Data to post error: ", err);
        }
    }




    if(command === 'whales'){
        var apiLink = "https://api.ethplorer.io/getTopTokenHolders/"+ process.env.CONTRACT_TOKEN +"?apiKey=" + process.env.ETHPLORER_API_KEY + "&limit=11";
        
        async function makeWhalesTop(){
            var apiResponse = await fetch(apiLink);
            var data = await apiResponse.json();



            // SEND THE DISCORD MESSAGE

            const messageToBeSent = new MessageEmbed()
            .setColor('#655dff')
            .setAuthor('www.TheCyberEnterprise.com', 'https://i.imgur.com/oDZJsgu.png', 'https://thecyberenterprise.com/')
            .setDescription('Top 10 Whales!  :eyes: :eyes: :eyes: WE SEE YOU!! :eyes: :eyes: :eyes:')
            .setFooter('The Cyber Team', 'https://i.imgur.com/oDZJsgu.png');

           

            data.holders.forEach(whale => {

                if(whale.address != process.env.UNISWAP_ADDRESS){

                    var whaleBalance = Math.floor(whale.balance / 1000000000000000000);
                    whaleBalance = whaleBalance.toString();
                    whaleBalance = whaleBalance.replace(/\B(?=(\d{3})+(?!\d))/g, ",");


                    messageToBeSent.addField(whale.share + "% - " + whaleBalance + " CYBR", "[" + whale.address + "](https://etherscan.io/address/" + whale.address + ")")
                }

            });


            message.channel.send({ embeds: [messageToBeSent] });

        }

        try {
            if (message.channel == process.env.PRICE_CHANNEL_ID || message.channel == process.env.SPAM_CHANNEL_ID) {
            makeWhalesTop();
            } else {
                message.channel.send("Please send this command in the <#" + process.env.PRICE_CHANNEL_ID + "> or in <#" + process.env.SPAM_CHANNEL_ID + ">!")
            }
        } catch(err) {
            console.log("Make whales top error: ", err);
        }
    }


    if(command === 'wooptop'){
        async function makeWoopTop(){
            async function readData(){
                let dataX = fs.readFile('woops.json', "utf8", function (err, data) {
                    return data;
                });
    
                return dataX;
    
            }
    
            var dataFromFile = await readData();
            dataFromFile = JSON.parse(dataFromFile);



            var dataSorted = dataFromFile.sort((a, b) => (a.woopsCount < b.woopsCount) ? 1 : -1);


            // await bot.users.fetch(dataSorted[i].usernameId);



            if(typeof(dataSorted[0]) != "undefined"){
                var user1 = (await bot.users.fetch(dataSorted[0].usernameId)).username;

                if(dataSorted[0].woopsCount == 1){
                    var message1 = user1 + " only Wooped once :(";
                }else{
                    var message1 = user1 + " wooped " + dataSorted[0].woopsCount + " times!";
                }

            }else{
                var message1 = "Waiting for a new wooper!";
            }

            if(typeof(dataSorted[1]) != "undefined"){
                var user2 = (await bot.users.fetch(dataSorted[1].usernameId)).username;

                if(dataSorted[1].woopsCount == 1){
                    var message2 = user2 + " only Wooped once :(";
                }else{
                    var message2 = user2 + " wooped " + dataSorted[1].woopsCount + " times!";
                }

            }else{
                var message2 = "Waiting for a new wooper!";
            }

            if(typeof(dataSorted[2]) != "undefined"){
                var user3 = (await bot.users.fetch(dataSorted[2].usernameId)).username;

                if(dataSorted[2].woopsCount == 1){
                    var message3 = user3 + " only Wooped once :(";
                }else{
                    var message3 = user3 + " wooped " + dataSorted[2].woopsCount + " times!";
                }

            }else{
                var message3 = "Waiting for a new wooper!";
            }

            if(typeof(dataSorted[3]) != "undefined"){
                var user4 = (await bot.users.fetch(dataSorted[3].usernameId)).username;

                if(dataSorted[3].woopsCount == 1){
                    var message4 = user4 + " only Wooped once :(";
                }else{
                    var message4 = user4 + " wooped " + dataSorted[3].woopsCount + " times!";
                }

            }else{
                var message4 = "Waiting for a new wooper!";
            }

            if(typeof(dataSorted[4]) != "undefined"){
                var user5 = (await bot.users.fetch(dataSorted[4].usernameId)).username;

                if(dataSorted[4].woopsCount == 1){
                    var message5 = user5 + " only Wooped once :(";
                }else{
                    var message5 = user5 + " wooped " + dataSorted[4].woopsCount + " times!";
                }

            }else{
                var message5 = "Waiting for a new wooper!";
            }


            if(typeof(dataSorted[5]) != "undefined"){
                var user6 = (await bot.users.fetch(dataSorted[5].usernameId)).username;

                if(dataSorted[5].woopsCount == 1){
                    var message6 = user6 + " only Wooped once :(";
                }else{
                    var message6 = user6 + " wooped " + dataSorted[5].woopsCount + " times!";
                }


            }else{
                var message6 = "Waiting for a new wooper!";
            }

            if(typeof(dataSorted[6]) != "undefined"){
                var user7 = (await bot.users.fetch(dataSorted[6].usernameId)).username;

                if(dataSorted[6].woopsCount == 1){
                    var message7 = user7 + " only Wooped once :(";
                }else{
                    var message7 = user7 + " wooped " + dataSorted[6].woopsCount + " times!";
                }

            }else{
                var message7 = "Waiting for a new wooper!";
            }

            if(typeof(dataSorted[7]) != "undefined"){
                var user8 = (await bot.users.fetch(dataSorted[7].usernameId)).username;

                if(dataSorted[7].woopsCount == 1){
                    var message8 = user8 + " only Wooped once :(";
                }else{
                    var message8 = user8 + " wooped " + dataSorted[7].woopsCount + " times!";
                }

            }else{
                var message8 = "Waiting for a new wooper!";
            }


            if(typeof(dataSorted[8]) != "undefined"){
                var user9 = (await bot.users.fetch(dataSorted[8].usernameId)).username;

                if(dataSorted[8].woopsCount == 1){
                    var message9 = user9 + " only Wooped once :(";
                }else{
                    var message9 = user9 + " wooped " + dataSorted[8].woopsCount + " times!";
                }

            }else{
                var message9 = "Waiting for a new wooper!";
            }

            if(typeof(dataSorted[9]) != "undefined"){
                var user10 = (await bot.users.fetch(dataSorted[9].usernameId)).username;

                if(dataSorted[9].woopsCount == 1){
                    var message10 = user10 + " only Wooped once :(";
                }else{
                    var message10 = user10 + " wooped " + dataSorted[9].woopsCount + " times!";
                }

            }else{
                var message10 = "Waiting for a new wooper!";
            }




             // SEND THE DISCORD MESSAGE

             const messageToBeSent = new MessageEmbed()
             .setColor('#655dff')
             .setAuthor('www.TheCyberEnterprise.com', 'https://i.imgur.com/oDZJsgu.png', 'https://thecyberenterprise.com/')
             .setDescription('So you want to know who are the Top 10 Woopers!?')
             .addField('1st', message1)
             .addField('2nd', message2)
             .addField('3rd', message3)
             .addField('4th', message4)
             .addField('5th', message5)
             .addField('6th', message6)
             .addField('7th', message7)
             .addField('8th', message8)
             .addField('9th', message9)
             .addField('10th', message10)
             .setFooter('The Cyber Team', 'https://i.imgur.com/oDZJsgu.png');

            message.channel.send({ embeds: [messageToBeSent] });

        }

        try {
            if (message.channel == process.env.SPAM_CHANNEL_ID) {
            makeWoopTop();
            } else {
                message.channel.send("Please send this command in the <#" + process.env.SPAM_CHANNEL_ID + ">!")
            }
        } catch(err) {
            console.log("Make woop top error: ", err);
        }
    }

    if(command === 'chart'){


        var dextools = "https://www.dextools.io/app/ether/pair-explorer/0x4bbd1ddc2ded3c287b74dbf3c2e500631de4bf50";


        var errorPrintscreen = false;
        

        async function getChart() {

            const delay = ms => new Promise(res => setTimeout(res, ms));

            if(!errorPrintscreen){
                message.channel.send(`This will take me a while .. so please be patient.`);
            }
            

            
            const browser = await puppeteer.launch(2);


            if(!errorPrintscreen){
                message.channel.send(`I am opening dextools.io in the browser.`);
            }
            

            const page = await browser.newPage();
            await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36");
            await page.setViewport({ width: 1560, height: 900 });
            page.setDefaultNavigationTimeout(0);

            

            if(!errorPrintscreen){
                message.channel.send(`Waiting for the page to load ..`);
            }

            await page.goto(dextools, { waitUntil: 'networkidle0' }).catch(() => console.log('timeout go to...'));

            // await page.screenshot({path: 'example.png'}).catch((e) => console.log('timeout... screenshot' + e));

            message.channel.send(`I am making a screenshot ..`);

            await delay(5000);

            var dateNowVar = Date.now();

            await page.screenshot({
                path: 'charts/chart_'+ dateNowVar +'.png',
                clip: {
                x: 364,
                y: 357,
                width: 894,
                height: 510,
                }
            }).catch((e) => {
                message.channel.send(`There was a problem with the screenshot. I am doing it again.`);
                errorPrintscreen = true;
                getChart();
                
            });

            if(!errorPrintscreen){



                const file = new MessageAttachment("charts/chart_"+ dateNowVar +".png");

                const exampleEmbed = {
                    image: {title: '',
                        url: 'attachment://discordjs.png',
                    },
                };

                message.channel.send({ files: [file] });

                console.log("chart sent");

            }

            

            await browser.close();

        }

        try {
            if (message.channel == process.env.PRICE_CHANNEL_ID || message.channel == process.env.SPAM_CHANNEL_ID) {
            getChart();
            } else {
                message.channel.send("Please send this command in the <#" + process.env.PRICE_CHANNEL_ID + "> or in <#" + process.env.SPAM_CHANNEL_ID + ">!")
            }
        } catch(err) {
            console.log("Get Chart error: ", err);
        }
     


    }

    if(command === 'info'){
        // var dextools = "https://www.dextools.io/app/ether/pair-explorer/0x4bbd1ddc2ded3c287b74dbf3c2e500631de4bf50";

        // async function getInfo() {

        //     message.channel.send("I'm working on it...")

        //     const browser = await puppeteer.launch();
        //     const page = await browser.newPage();

        //     await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36");
        //     await page.setViewport({ width: 1560, height: 900 });
        //     page.setDefaultNavigationTimeout(0);

        //     await page.goto(dextools, { waitUntil: 'networkidle2' }).catch(() => console.log('timeout go to...'));

        //     await page.waitForSelector('div.price-indicators-container');

        //     message.channel.send("Give me just a minute...");

        //     await new Promise(resolve => setTimeout(resolve, 10000));            

        //     // Getting price
        //     var node1 = await page.$eval('body > app-root > div > div > main > app-exchange > div > app-pairexplorer > app-layout > div > div > div > div.ng-tns-c140-2.row-center-column.calculated-width > div > div.graph-header.ng-tns-c140-2 > div:nth-child(1) > div.ng-tns-c140-2.ng-star-inserted > div > div > div:nth-child(1) > strong', node => node.innerText);
        //     var price = node1;

        //     // Getting eth price
        //     var node2 = await page.$eval('body > app-root > div > div > main > app-exchange > div > app-pairexplorer > app-layout > div > div > div > div.ng-tns-c140-2.row-center-column.calculated-width > div > div.graph-header.ng-tns-c140-2 > div:nth-child(1) > div.ng-tns-c140-2.ng-star-inserted > div > div > div.d-flex.d-md-flex.ng-tns-c140-2.ng-trigger.ng-trigger-simpleFadeAnimation > span', node => node.innerText);
        //     var ethtemp = node2;
        //     ethtemp = ethtemp.split(" ");
        //     var ethPrice = ethtemp[1];
            
        //     // Getting 24 hour change
        //     var priceSymbolType = ""
        //     // try {
        //     //     var node3 = await page.$eval('body > app-root > div > div > main > app-exchange > div > app-pairexplorer > app-layout > div > div > div > div.ng-tns-c140-2.row-center-column.calculated-width > div > div.graph-header.ng-tns-c140-2 > div:nth-child(2) > div:nth-child(2) > div > app-percent-indicator', node => node.innerHTML);
        //     //     var tempChange24 = node3;
        //     //     tempChange24 = tempChange24.split(" ");
        //     //     tempChange24 = tempChange24[49];
        //     //     priceSymbolType = "up";
        //     // } catch (err) {
        //     //     console.log("Price is up!");
        //     // }
            
        //     try {
        //         var node = await page.$eval('span.neutral-value', node => node.innerHTML);
        //         var tempChange24 = node;
        //         tempChange24 = tempChange24.split(" ");
        //         tempChange24 = tempChange24[tempChange24.length - 2];
        //         priceSymbolType = "neutral";
        //     } catch (err) {
        //         console.log("Price is neutral");
        //     }

        //     try {
        //         var node3 = await page.$eval('body > app-root > div > div > main > app-exchange > div > app-pairexplorer > app-layout > div > div > div > div.ng-tns-c140-2.row-center-column.calculated-width > div > div.graph-header.ng-tns-c140-2 > div:nth-child(2) > div:nth-child(2) > div > app-percent-indicator > div > span.sell-color', node => node.innerHTML);
        //         console.log('Node test');
        //         var tempChange24 = node3;
        //         tempChange24 = tempChange24.split(" ");
        //         tempChange24 = tempChange24[39];
        //         priceSymbolType = "down";
        //     } catch (err) {
        //         console.log("Price is down");
        //     }

        //     var tempSymbol = "";

        //     if(priceSymbolType == "up") {
        //         tempSymbol = "\u21E7";
        //     } else if (priceSymbolType == "down") {
        //         tempSymbol = "\u21E9";
        //     } else {
        //         tempSymbol = "\u002D"
        //     }
            
        //     var change24 = tempSymbol + " " + tempChange24;

        //     // Getting liquidity
        //     // var node5 = await page.$eval('body > app-root > div > div > main > app-exchange > div > app-pairexplorer > app-layout > div > div > div > div.row-left-column.ng-tns-c140-2.ng-star-inserted > div > div:nth-child(1) > app-pool-info > div > div > ul > li:nth-child(1) > span:nth-child(2)',node => node.innerHTML);
        //     // var liquidity = node5;

        //     // Getting daily volume
        //     var node6 = await page.$eval('body > app-root > div > div > main > app-exchange > div > app-pairexplorer > app-layout > div > div > div > div.row-left-column.ng-tns-c140-2.ng-star-inserted > div > div:nth-child(1) > app-pool-info > div > div > ul > li:nth-child(1) > span', node => node.innerHTML);
        //     var dailyVolume = node6;
        //     while (dailyVolume == "Calculating...") {
        //         var node6 = await page.$eval('body > app-root > div > div > main > app-exchange > div > app-pairexplorer > app-layout > div > div > div > div.row-left-column.ng-tns-c140-2.ng-star-inserted > div > div:nth-child(1) > app-pool-info > div > div > ul > li:nth-child(2) > span', node => node.innerHTML);
        //         var dailyVolume = node6;
        //     }

        //     // Getting pooledEth
        //     // var node7 = await page.$eval('body > app-root > div > div > main > app-exchange > div > app-pairexplorer > app-layout > div > div > div > div.row-left-column.ng-tns-c140-2.ng-star-inserted > div > div:nth-child(1) > app-pool-info > div > div > ul > li:nth-child(3) > span', node => node.innerHTML);
        //     // var pooledEth = node7;

        //     // Getting pooledCybr
        //     // var node8 = await page.$eval('body > app-root > div > div > main > app-exchange > div > app-pairexplorer > app-layout > div > div > div > div.row-left-column.ng-tns-c140-2.ng-star-inserted > div > div:nth-child(1) > app-pool-info > div > div > ul > li:nth-child(4) > span', node => node.innerHTML);
        //     // var pooledCybr = node8;

        //     // Getting transactionsTotal
        //     // var node9 = await page.$eval('body > app-root > div > div > main > app-exchange > div > app-pairexplorer > app-layout > div > div > div > div.row-left-column.ng-tns-c140-2.ng-star-inserted > div > div:nth-child(1) > app-pool-info > div > div > ul > li:nth-child(6) > span', node => node.innerHTML);
        //     // var transactionsTotal = node9;

        //     // Getting holdersTotal
        //     var node10 = await page.$eval('body > app-root > div > div > main > app-exchange > div > app-pairexplorer > app-layout > div > div > div > div.row-left-column.ng-tns-c140-2.ng-star-inserted > div > div:nth-child(1) > app-pool-info > div > div > ul > li:nth-child(2) > span', node => node.innerHTML);
        //     var holdersTotal = node10.split(" ");
        //     holdersTotal = holdersTotal[1];

        //     // console.log(price);
        //     // console.log(change24);
        //     // console.log(ethPrice);
        //     // console.log(liquidity);
        //     // console.log(dailyVolume);
        //     // console.log(pooledEth);
        //     // console.log(pooledCybr);
        //     // console.log(transactionsTotal);
        //     // console.log(holdersTotal);
        //     // console.log(dilutedMc);


        //     //SEND THE DISCORD MESSAGE

        //     const messageToBeSent = new MessageEmbed()
        //     .setColor('#655dff')
        //     .setAuthor('www.TheCyberEnterprise.com', 'https://i.imgur.com/oDZJsgu.png', 'https://thecyberenterprise.com/')
        //     .setDescription("General information about CYBR taken from dextools.io")

        //     .addField('Price in USD', price)
        //     .addField('Price in ETH', ethPrice)
        //      .addField('Last 24 hours change', change24)
        //     // .addField('Total Liquidity', liquidity)
        //     .addField('Daily Volume', dailyVolume)
        //     // .addField('Pooled WETH', pooledEth)
        //     // .addField('Pooled CYBR', pooledCybr)
        //     // .addField('Transactions Number', transactionsTotal)
        //     .addField('Holders', holdersTotal)
        //     .setFooter('The Cyber Team', 'https://i.imgur.com/oDZJsgu.png');

        //     message.channel.send({ embeds: [messageToBeSent] });

        //     await browser.close();
        // }

        // try {
        //     if (message.channel == process.env.PRICE_CHANNEL_ID || message.channel == process.env.SPAM_CHANNEL_ID) {
        //     getInfo();
        //     } else {
        //         message.channel.send("Please send this command in the <#" + process.env.PRICE_CHANNEL_ID + "> or in <#" + process.env.SPAM_CHANNEL_ID + ">!")
        //     }
        // } catch(err) {
        //     console.log("Get info error: ", err);
        // }

        message.channel.send("This command is currently under development. Sorry bud.");
    }


    if(command === 'price'){
        // var dextools = "https://www.dextools.io/app/ether/pair-explorer/0x4bbd1ddc2ded3c287b74dbf3c2e500631de4bf50";

        // async function getPrice() {

        //     message.channel.send("Fetching Price...")

        //     const browser = await puppeteer.launch();
        //     const page = await browser.newPage();

        //     await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36");
        //     await page.setViewport({ width: 1560, height: 900 });
        //     page.setDefaultNavigationTimeout(0);

        //     await page.goto(dextools, { waitUntil: 'networkidle2' }).catch(() => console.log('timeout go to...'));

        //     await page.waitForSelector('.price-indicators-container');

        //     message.channel.send("Wait one moment...")

        //     const els = await page.$eval('body > app-root > div.container-fluid.icon-sidebar-nav.ng-tns-c70-0 > div > main > app-exchange > div > app-pairexplorer > app-layout > div > div > div > div.ng-tns-c140-11.row-center-column.full-width > div > div.graph-header.ng-tns-c140-11 > div:nth-child(1) > div.ng-tns-c140-11.ng-star-inserted > div > div > div:nth-child(1) > strong', node => node.innerHMTL);
                
        //         // let elementText = await els[i].$eval('span', node => node.innerHTML);
                
        //         var spanTag = els;

        //         // SEND THE DISCORD MESSAGE

        //         const messageToBeSent = new MessageEmbed()
        //         .setColor('#655dff')
        //         .setAuthor('www.TheCyberEnterprise.com', 'https://i.imgur.com/oDZJsgu.png', 'https://thecyberenterprise.com/')
                
        //         .addField('Current CYBR Price: ', spanTag)
        //         .setFooter('The Cyber Team', 'https://i.imgur.com/oDZJsgu.png');

        //         message.channel.send({ embeds: [messageToBeSent] });



        //     await browser.close();
        // }

        // try {
        //     if (message.channel == process.env.PRICE_CHANNEL_ID || message.channel == process.env.SPAM_CHANNEL_ID) {
        //     getPrice();
        //     } else {
        //         message.channel.send("Please send this command in the <#" + process.env.PRICE_CHANNEL_ID + "> or in <#" + process.env.SPAM_CHANNEL_ID + ">!")
        //     }
        // } catch(err) {
        //     console.log("Get price error: ", err);
        // }

        message.channel.send("This command is currently under development. Sorry bud.");
    }

    if(command === 'help'){

             // SEND THE DISCORD MESSAGE

             const messageToBeSent = new MessageEmbed()
             .setColor('#655dff')
             .setAuthor('www.TheCyberEnterprise.com', 'https://i.imgur.com/oDZJsgu.png', 'https://thecyberenterprise.com/')
             .setDescription("I'm getting better at this each day so check the !help command once in a while.")
             .addField('Channels:', "Only available in Charts and Bot-Spam channels!\n")
             .addField('!whales', "Shows a list of top 10 whales. Must be in charts or bot-spam channel.")
             .addField('!holders', "Shows the total number of holders. [not very accurate]")
             .addField('!burned', "Shows the total number of tokens burned so far.")
             .addField('!chart', "Shows a capture of the dextools.io chart.")
             .addField('!price', "Shows the current price of CYBR from dextools.io")
             .addField('!info', "Shows the general information of CYBR from dextools.io")
             .addField('!contract', "Sends a link to the smart contract via EtherScan")
             .addField('!wooptop', "Shows a list of top 10 woopers.\n")
             .addField('Channels:', "Available in any channel!\n")
             .addField('!reddit', "Sends the link to the Cyber Enterprise Reddit")
             .addField('!telegram', "Sends the link to the Cyber Enterprise Telegram")
             .addField('!website', "Sends the links to the Cyber websites")
             .addField('!vote', "Shows a list of all listing that we can upvote!")
             
             .setFooter('The Cyber Team', 'https://i.imgur.com/oDZJsgu.png');

            message.channel.send({ embeds: [messageToBeSent] });
    }

    if(command === 'reddit') {
        message.channel.send('https://www.reddit.com/r/TheCyberEnterprise/')
    }

    if(command === 'contract') {
        message.channel.send('https://etherscan.io/address/0x438a6e42813118548c065336844239b63ad4fcfd')
    }

    if(command === 'website') {
        message.channel.send('https://thecyberenterprise.com/ https://thecybercreditors.com/ https://thecyberinu.com/')
    }

    if(command === 'telegram') {
        message.channel.send('https://t.me/TheCyberEnterprise')
    }

    if(command === 'vote') {
        const messageToBeSent = new MessageEmbed()
        .setColor('#655dff')
        .setTitle('CYBR Voting Links')
        .setAuthor('www.TheCyberEnterprise.com', 'https://i.imgur.com/oDZJsgu.png', 'https://thecyberenterprise.com/')
        .setDescription('Hey guys! Hey guys! Everyone should go to these links and vote for CYBR!')
        .addField('Upvote Links:',
            '[Blockfolio](https://feedback.blockfolio.com/coin-requests/p/httpswwwthecyberenterprisecom)\n' +
            '[CoinAlpha](https://coinalpha.app/token/0x438a6E42813118548C065336844239b63ad4Fcfd)\n' +
            '[CoinDiscover](https://coindiscovery.app/coin/cyber)\n' +
            '[CoinHunt](https://coinhunt.cc/coin/529477220)\n' +
            '[CoinHunters](https://coinhunters.cc/tokens/Cyber)\n' +
            '[CoinMooner](https://coinmooner.com/coin/13424)\n' +
            '[Coinscope](https://www.coinscope.co/coin/1-cybr#login&vote)\n' +
            '[CoinSniper](https://coinsniper.net/coin/27671)\n' +
            '[CoinVote](https://coinvote.cc/coin/Cyber)\n' +
            '[FreshCoins](https://www.freshcoins.io/coins/cyber)\n' +
            '[GemFinder](https://gemfinder.cc/gem/7798)\n' +
            '[RugFreeCoins](https://www.rugfreecoins.com/details/8084)'
        )
        .setFooter('The Cyber Team', 'https://i.imgur.com/oDZJsgu.png');

        message.channel.send({ embeds: [messageToBeSent] });
}
});



bot.on('messageCreate', message => {
    if(message.content.toLowerCase().startsWith("woop woop")){

      

            if(message.author.id == ""){ // banned user id
                message.channel.send(`Let me hear a "Woop woop" if you are a bot <@${message.author.id}>!!`);
            }else{


                async function makeItWhoop(){
                    async function readData(){
                        let dataX = fs.readFile('woops.json', "utf8", function (err, data) {
                            return data;
                        });
            
                        return dataX;
            
                    }
            
                    var dataFromFile = await readData();
                    dataFromFile = JSON.parse(dataFromFile);
            
        
        
        
                    if(dataFromFile.some(woop => woop.usernameId === message.author.id)){
        
                        var objIndex = dataFromFile.findIndex((obj => obj.usernameId == message.author.id));
        
                        dataFromFile[objIndex].woopsCount = dataFromFile[objIndex].woopsCount + 1;
        
        
                        var woopCountToSay = dataFromFile[objIndex].woopsCount;
        
        
                    }else{
                        var woops = {
                            usernameId : message.author.id,
                            woopsCount : 1
                        }
        
                        dataFromFile.push(woops);
                        var woopCountToSay = 1;
                    }
            
                    
            
            
                    fs.writeFile("woops.json", JSON.stringify(dataFromFile), function(err){
                        if (err) throw err;
                        console.log('The "data to append" was appended to file!');
                    });
        
        
        
                    if(woopCountToSay == 1){
                        message.channel.send(`Guys! We have a FIRST TIME WOOPER here! Keep on WOOPING <@${message.author.id}>!!`);
                    }else{
                        message.channel.send(`<@${message.author.id}> you have wooped ` + woopCountToSay + " times so far! Keep on WOOPING!!");
                    }
                    
                }
        
                try {
                    makeItWhoop();
                } catch(err) {
                    console.log("Make it whoop error: ", err);
                }






            }
  


        


    }

});







bot.login(botToken);