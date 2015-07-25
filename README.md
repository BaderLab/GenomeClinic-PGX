Clinical Genomics Web App
==========

Web application for clinical pharmacogenomic interpretation.

## Dependencies
1. [Node.js](http://nodejs.org/)
2. [MongoDB](http://mongodb.org/downloads)
4. [PhantomJS](http://phantomjs.org/) 2.0.0 or later

Clinical Pharmacogenetics is a new and growing field with large implications for patient care. As genetic information becomes more readily available, the software used to interpret it must also become more broadly accesible and reliable for a wide range of client usage. GenomeClinic-PGX attempts to address the issues posed by having a diverse user group by providing an easy to use interface for data entry and report generation. GenomeClinic-PGX takes information on genetic variation in the form of VCF files or a custom file format described [here](docs/custom_format.md) and performs a pharmacogenetic analysis on a specified set of variants. The results from this analysis are then used to provide a detailed and customizable report containing drug recommendations and a genetic profile of the patient for use by the clinicians.

The GenomeClinic-PGX web server is built in [Node.js](http://nodejs.org) as an [express](http://expressjs.com/) application. It uses mongo is used for back end storage of all information, including the session data store. The design of the dabatase can be found [here](docs/database_design.md). On the client side the app employs the [Handlebars.js](http://handlebarsjs.com/) templating engine in combination with [Jquery](http://jquery.com) and native javascript in order to produce dynamic and responsive page content that gives a fluid feeling to the web interface. In addition, [Foundation 5](http://foundation.zurb.com) is used as a comprehensive front end framework that enables fast, rapid prototpying of new page content.

Reports are the cornerstone of the app and are generated in PDF format with the use of [PhantomJS](http://phantomjs.org). Any custom template can be designed and used for the final report quite easily using a handlebars template.

## MongoDB setup

MongoDB is a noSQL database with built in js support. Our web application requires a MongoDB server to be running that can easily be connected to. To install. To install on unix type the following:

Client software
`sudo apt-get install mongodb-client`

Server Software
`sudo apt-get install mongodb-server`

Once installed, you will need to run the MongoDB server prior to running our web application server. Create a `db_data/` directory and then type the following to start the server listening on port 27017

`mongod --dbpath=db_data/ --port 27017`

The default port number for mongo is 27017. If you want to change this feel free, however in order to connect you will need to modify the [constants.json](src/server/conf/constants.json) file to reflect the new port. change dbConstants.PORT to whatever your desired port is.

It is recomended that you modify the default settings for namespace file size when first initializing the server. The default setting limits the number of namespaces to a maximum of 24000 per databse or a ns file of 16mb. This is generally enough, however a databse running over a longer perior of time may accumulate far more namespaces then this. The namespace file go be written up to a maximum of 2gb per db effectively providing upt to 3,000,000 potential namespaces. To set this when starting the server simply run the service with the addition `--nssize` command and the number of megabytes you want the namespace file to be. For example, a mazium nsfile size of 2gb would be:

`mongod --dbpath=db_data/ --port 27017 --nssize 2048`

There are a variety of other options you can customize, we suggest reading the [documentation](http://docs.mongodb.org/manual/reference/configuration-options/) about server configuration. It is important to note that at this time, the app does not support an authenticated database. This will be coming in the near future. 	

## Setting up the server

When you first download the sourcecode, you will need to install the package dependencies within the package.json file. If you are building the web app from source, you will need all the dev dependencies. However if you are using a previously built version you can only install the production dependencies. To install all dependencies open a terminal and within the main project folder type the following command:

`npm install`

or

`npm install --production`

this will take care of installing all of the dependencies listed within the package.json file.

We are using gulptasks to automate the deploying of both the server and the client front end. After installing the package.json type the following command to build the working server:

`sudo node_modules/.bin/gulp`

This will deploy the project and place it in the build folder. To properly run the gulp task you must run it as sudo in order to install global dependencies. By default gulp will enter into a watch loop, rerunning tasks when any of the src files change. If you are working on developing this project, simply leave the terminal running and modify the files within the src/ directory instead of the files within the build/ directory. Changes in build/ will not be tracked.

To disable this behaviour and build a production quality server run the gulp command but pass it the production task as an option

`node_modules/.bin/gulp --type production`

To clean the the build directory run:

`sudo node_modules/.bin/gulp clean`

the command has to be run in sudo if you have already run the server. This is because the log files require sudo permissions to remove.

## Running the server

Running the server is quite easy. There are several customizable options that you can pass in order to change basic functionality (such as enabling signup and password recovery or even oauth login). The basic usage utilizing all defaults is:

`node webapp.js`

Depending on what ports you are running the server on you may have to run the command as sudo. The default ports (443 for https and 80) are closed by default on a unix based system.

## Running the server with https

If you possess an https certificate and would like to use only https routes, the server is set up so that you can easily configure it for this purpose. It will automatically redirect all incoming http traffic to a secure https connection. This behaviour is toggled with a single command, however it requires you provide it with a key and crt file as well.

`node webapp.js --https --key path/to/key --crt path/to/crt`

The server by default operates on ports 80 and 443 (for https traffic). You can modify this with the `--httpsport` and `--httpport` commands followed by the desired port number. We do not recommend you to use non standard ports, unless you must. For a complete list of options run

`node webapp.js -h`

## Killing the Server

The server can be terminated by typing "CTRL-C" in a Unix terminal.

If you are going to run the server in the background, like this

`node webapp.js &`

we advise that you terminate the server using a SIGINT, allowing the server to exit gracefully:

`kill -SIGINT <process_id>`
