const chalk = require('chalk');

module.exports = {


    logSuccess: function(msg){
        console.log(chalk.bgGreen.bold(msg));
    },

    logSuccessSimple: function(msg){
        console.log(chalk.green.bold(msg));
    },

    logError: function(msg){
        console.log(chalk.bgRed.bold(msg));
    },
    logErrorSimple: function(msg){
        console.log(chalk.red.bold(msg));
    }


    



};