Clinical Genomics Web App
==========

Web application for clinical pharmacogenomic interpretation.

## Dependencies
1. [Node.js](http://nodejs.org/)
2. [MongoDB](http://mongodb.org/downloads)
3. [Annovar](http://www.openbioinformatics.org/annovar/annovar_download_form.php)
4. [PhantomJS](http://phantomjs.org/) 2.0.0 or later

The web server is built as an [express](http://expressjs.com/) app and utilizes a mongo database for back end storage of variant information as well as general server information. Additionally the current annotation pipeline utilizes Annovar for variant annotation. Annovar is a third party application which requires a licesnce agreement and can be used for free so long as it is not for commercial purposes.

PhantomJS must be installed and accessible through the path environment variable

## Annovar Installation

Simply follow the instrcutions on the annovar website to install. Additionally there are several annotation libraries that the webserver expects to be installed. We have included a convienient script that will download the required libraries for you, assuming that annovar has already been installed. To do so run the script in a terminal with one argument directing the script to the annovar folder.

```shell
./download_annovar_modules.sh /path/to/annovar
```

You will need approximaetly 35gb of hard disk space to accomodate all of the databases once they are downloaded and unpacked. 

Optionally, if you did not want to downalod all of the annotations, simply pick the annotations you want to download from the list below of currently supported annotations

1. knowngene
2. ljb26_all
3. cg69
4. esp6500_all
5. 1000g2014sep_all
6. clinvar_20140929
7. snp138

Use the following command to download each database individually


```shell
/path/to/annovar/annotate_variation.pl -buildver hg19 -downdb -webfrom annovar [database] humandb/
```

Then once you start the server for the first time, check off the databses that were installed from the configuration page to let the server know which annotations to inlcude.

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


## Google OAUTH Setup.
This app is enabled to use google-OAUTH2, however in order for this to work you must activate it from the [google developers console](https://console.developers.google.com/).

Once there click on the 'Create Project' tab, make a name for it, agree to the terms then click accept. IT will take several moments for
a new project to be created

once your project is created, click on 'APIS & auth' in the sidebar and select "Create New Client Id" under the OAUTH. A new screen will pop up the default option 'Web application' selected. This is what we want, so click Configure Consent Screen. Here you can customize what people see when they attempt to authenticate with Google. It has several required fields, but most are options. Click save.

A new screen will pop up asking for you to create a client ID. This will ask for the Authorized Javascript origins and the Authorized Redirect URIS.

For the Authorized Javascript origin, type in the http address of your server. ie the ip address or: localhost:8080 if you are running from your own computer. for example:

`127.0.0.1`

Under the Authorized Redirect URIS type in

`http://127.0.0.1/auth/google/callback`


click save. This will generate A client ID that is registered with google. The next thing you will want to do is copy and past the:

1. callback url
2. client ID
3. client Secret

to the api.js script located in src/server/conf/. Once this is done you should now have a perfectly functioning OAUTH system for google!

