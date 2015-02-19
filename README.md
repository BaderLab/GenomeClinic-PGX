Frangipani
==========

Web application for clinical pharmacogenomic interpretation.

## Quick setup

The application server in development is in accordance with GA4GH API. Currently it is being tested with the Google Genomics cloud service.

The application server uses [Node.js](http://nodejs.org/), so download and install that first from the link provided. Node.js Will run on all machines, simply download the appropriate binaries or installers.

## MongoDB installation and setup

MongoDB is a noSQL database with built in js support. Our web application requires a local MongoDB server to be running. To install, you can download the binaries [here](http://www.mongodb.org/downloads) for all platforms and distributions.

Once installed, you will need to run the MongoDB server prior to running our web application server. Create a `db_data/` directory and then type the following to start the server listening on port 27017

`mongod --dbpath=db_data/ --port 27017`


Feel free to change the location of the `db_data/` directory. If you change the port ensure that you also change
the corresponding port number in DB.js.



## Package installation:

To get all the node packages:

`npm install`

To start the server on localhost, port 8080:

`node server.js`

For more options, see the help message:

`node server.js -h`

The server can be terminated by typing "CTRL-C" in a Unix terminal.

If you are going to run the server in the background, like this

`node server.js &`

we advise that you terminate the server using a SIGINT, allowing the server to exit gracefully:

`kill -SIGINT <process_id>`


## Annovar Installation

Annovar is a suite of perl tools that can be downloaded from [Here](http://www.openbioinformatics.org/annovar/annovar_download_form.php). It requires you to register prior to downloading the file, a link will then be sent to the email provided. 

once downloaded, open a terminal and navigated to the annovar/ directory and run the following commands to install the appropriate databases


```shell
perl annotate_variation.pl -buildver hg19 -downdb -webfrom annovar knowngene humandb/
perl annotate_variation.pl -buildver hg19 -downdb -webfrom annovar ljb26_all humandb/
perl annotate_variation.pl -buildver hg19 -downdb -webfrom annovar cg69 humandb/
perl annotate_variation.pl -buildver hg19 -downdb -webfrom annovar esp6500_all humandb/
perl annotate_variation.pl -buildver hg19 -downdb -webfrom annovar 1000g2014sep_all humandb/
perl annotate_variation.pl -buildver hg19 -downdb -webfrom annovar clinvar_20140929 humandb/
```

## Google OAUTH Setup.

This app is enabled to use google-OAUTH2, however in order for this to work you must activate it from the [google developers console](https://console.developers.google.com/).

Once there click on the 'Create Project' tab, make a name for it, aggree to the terms then click accept. IT will take several moments for
a new project to be created

once your project is created, click on 'APIS & auth' in the side bar and select "Create New Client Id" under the OAUTH. A new screen will pop up the default option 'Web apllication' selected. This is what we want, so click Configure Consent Screen. Here you can customize what people see when they attempt to authenticate with Google. It has several required fields, but most are options. Click save.

A new screen will pop up asking for you to create a client ID. This will ask for the Authorized Javascript origins and the Authorized Redirect URIS.

For the Authorized Javascript origin, type in the http address of your server. ie the ip address or: localhost:8080 if you are running from you own computer. for example:

```http://localhost:8080```

Under the Authorized Redirect URIS type in

```http://localhost:8080/auth/google/callback```


click save. This will generate A client ID that is registered with google. The next thing you will want to do is copy and past the:

1. callback url
2. client ID
3. client Secret

to the api.js script located in frangipani_node_module/. Once this is done you should now have a perfectly functionin OAUTH system for google!

These can be exceptionally large files so the download will take some time.
