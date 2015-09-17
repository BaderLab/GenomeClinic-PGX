/* Script to enable large scale database updates wihtout having to replace all the data in the
 * database. 
 *
 * WARNING: THESE FUNCTIONS WILL IRREVERSIBLY CHANGE THE CONTENTS OF THE DATABASE, PRIOR TO RUNNING
 * THE UPDATE< ENSURE THAT A VALID AND UP-TO-DATE BACKUP HAS BEEN MADE	
 */
const TARGET_VERSION = "1.1";

var db = connect("localhost/webappDB");

//check current db version. if the db version is below the required, peform the required updates in sequence.
var admin = db.admin.findOne();
var currVersion = admin.version
print("Checking current database version");

if (currVersion === undefined) {
	currVersion = "1.0";
	db.admin.update({_id:admin._id},{$set:{version:currVersion}});
}


if (currVersion == TARGET_VERSION) {
	print("The database is currenly up to date. Exiting")
	quit();
}



print("Curent database Version is: " + currVersion + ", attempting to perform updates\n");


/* This simple update enables the use of multi-relationship future recommendations that are dependant
 * upon one another */
if (currVersion < "1.1"){
	print("Updating database to version 1.1");
	var original = db.future.find().toArray();
	var newSet = db.future.find().toArray();
	var updateString;
	for (var i = 0;  i < newSet.length; i++ ){
		updateString = {$set:{genes:[newSet[i].gene],classes:[newSet[i].class]},$unset:{gene:"",class:""}};
		db.future.update({_id:newSet[i]._id},updateString);
	}

	currVersion = "1.1";
	db.admin.update({_id:admin._id},{$set:{version:currVersion}});
}

