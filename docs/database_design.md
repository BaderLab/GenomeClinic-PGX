## Design of documents and collections for mongodb:	

The following document contains information about the various database structures being using within the back end mongoDB.


### Admin Collection
The admin collection contains information pertinent to the running of the server. This is configurable information that can be changed by the Admin user. The collection is comprised of a single document.

**Default Collection Name:** admin

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| curr_patient_index | Number | Current number to be appended to a new patient collection (p<NUM>)to store vcf info | no |
| config | Bool | Stores the status of the database, ie has it been configured by the user or not | no | 
| institution | String | The institution that is using the PGX app | no |
| admin-email | String | Email of the admin user. Setting this provides the admin certain privileges over a regular user. | no |
| max-query-records | Number | Deprecated | no |
| report-footer | String | Generic disclaimer used on the bottom of reports | no |

```js
{
	"_id" : ObjectId(),
	"curr_patient_index" : Number,
	"curr_panel_index" : Number,
	"config" : Boolean,
	"institution" : String,
	"admin-email" : email,
	"max-query-records" : Number,
	"report-footer" : String
}
```

### Users Collection 
Information specific to each user. Currently this field is underutilized and does not really have any use beyond logging in and out

**Default Collection Name:** users


| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| username | String | Unique email for each user | yes |
| password | String | B-crypted password string | no |


```js
{
	"_id" : ObjectId(),
	"username" : String,
	"password" : bcrypt
}
```



### Patients Collection
Contains information about all the patients that have been uploaded, including the collection name for the patient variant information

**Default Collection Name:** patients

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
| _id | ObjectId | Unique document Id | yes |
| patient_id | String | Unique patient Identifier given by the user | yes |
| file | String | File name of the vcf file | no |
| added | Date | Date the file was uploaded initially | no |
| ready | Bool | Whether the file has finished annotation and uploading to db | no |
| completed | Date | Date the file finished uploading | no |
| owner | String | Email of the user who uploaded the patient | no |
| collection_id | String | Name of the Collection containing the annotated vcf file |no |
| tags | Array | Name of projects the patient is included in | no |



```js
{
	"_id" : ObjectID,
	"patient_id" : String,
	"file" : String,
	"added" : String,
	"ready" : true,
	"completed" : String,
	"owner" : String,
	"collection_id" : String,
	"tags" : Array
}
```

### Individual Patient Collection
Each patient has an individual patient collection assigned to them when they are uploaded. This contains all of the information from the annotate vcf file, each document in this collection corresponds to a single entry in the .vcf file. The number assigned to the patient collections is found in admin.curr_patient_index and is incremented each time a patient is added.

The information stored in this collection varies depending on the source of the variant information (either the custom .TSV or a .VCF), however there are variety of fields which are required that will always be present in each document.

**Default Collection Name:** p(number);

| **Field**  | **Type** | **Definition** | **Indexed** | **required** |
|:------------|:-----:|:------------|:------:|:---:|
|_id | ObjectId | Unique document Id | yes | yes |
| id | string | rsID of the Variant if any | yes | yes |
| ref | String | Reference Allele for this position | no | yes | 
| alt | Array | Array of alternate alleles for this position | no | yes |
| original_alt | String | Original alternate allele prior to shifting position | no | yes |
| original_ref | String | Original reference allele prior to shifting position | no | yes |
| zygosity | String | Based on the genotype is the user homo_ref homo_alt or heter | yes | no |
| gt-raw | String | Raw genotype with phasing status recorded in vcf file | no | no |
| gt | Array | Genotype of the patient, first index  is ref, second is alt | no | yes |
| phased_status | Bool | Whether the information is phased or not | no | yes |

```js
{
	"_id" : ObjectId(),
	"id" : string,
	"ref" : String,
	"alt" : String,
	"original_alt" : String,
	"original_ref" : String,
	"zygosity" : String,
	"gt-raw" : String,
	"gt" : [ ref , alt ],
	"phased_status" : Boolean
}
```


### Project Collection
Each document in the project collection corresponds to a separate project. The document outlines the project name and permissions, as well as when it was created.

**Default Collection Name:** projects

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| project_id | String | Unique Id given to each project by the user | yes |
| description| String | Description of the project | no |
| keywords | string | Keywords assigned to the project, kind of like a short description| no |
| owner | String | Email of the user who created the project | no | 
| users | Array | Emails of all authorized users added to the project | no |
| date | Date | Date the project was created | no |


```js
{
	"_id" : ObjectId,
	"project_id" : String,
	"keywords" : String,
	"description" : String,
	"owner" : String,
	"users" : Array,
	"date" : String
}
```

### PGx Marker Collection
Each document in this collection corresponds to a single marker used in the PGX analysis and has information on the position and alleles for that marker. There are two types of markers, dbSnp markers and Custom markers. The dbsnp markers were retrieved directly from the NCBI's dbSnp and contain a greater amount of infrmation then the custom markers, such as the build version, etc of the marker.

**Default Collection Name:** pgxCoordinates

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
| _id | String | Unique rsID corresponding to the rsID's in dbSNP | yes |
| alt | Array | Expected alternate alleles | no |
| ref | String | Reference allele | no |
| type| string | signifies if the marker is a custom marker or a dbsnp marker and will be one of custom / dbsnp | no |
| date | date string | date of laste modification | no |

```js
{
	"_id" : ObjectId(),
	"id" : String,
	"alt" : Array,
	"type" : String,
	"date" : Date String,
	"ref" : String
}
```


### PGx Hapolotype Collection
All information regarding haplotypes is stored here. Each document in the collection corresponds to a single haploptype for a single gene with an array of information for the markers that are included. Within each gene, the haplotypes must be unique, in addition each haplotype must have a unique arrangement of markers for a given gene. 

**Default Collection Name:** pgxGenes

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
|gene| String | Unique gene name that the haplotypes apply to | yes |
| haplotype | String | The name of the current haplotype | no |
| markers | Array | a unique array (for each gene) of marker id's | no | 


```js
{
	"_id" : ObjectId(),
	"gene" : String,
	"haplotype" : Strign,
	"markers":[
		String
	]
}
```



### Gene collection
Each document corresponds to a single gene and allows easy retrieval of all information for that gene. It contains several arrays of identifiers which allow the server to easily retrieve information that is linked to the specified gene, as opposed to containing all of the informtion within the given array. This speeds up retrieval as it now uses indexed fields to find all of the associated documents as opposed to searching through a single document array.

 
**default collection name:** dosing


| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| gene | String | Unique Gene name | yes |
| type | String | One of four gene classes | no |
| haplotypes | Array| Array of OBjectID's pointing to a document in the haplotypes collection| no |
| recommendations | Array | Array of ObjectId's pointing to documents in the drugRecommendation collection | no |
| future | Array | Array of ObjectId's pointing to documents in the future collection | no |
| current_haplotypes | Array | Array of Object Id's pointing to haplotype documents that are connected to the current gene | no |
| markers | Array | Array of marker ID's pointing to marker collections | no |


```js
{
	"_id" : ObjectId(),
	"gene" : String, // unique key
	"haplotypes" : [
		ObjectId()
	],
	"recommendations" : [
		ObjectId()
	],
	"future" : [
		ObjectId()
	],
	"current_haplotypes":[
		ObjectId()
	]
	"markers":[
		String
	],
}
```

### Drug Recommendations
The drugReceomendation collection consists of all of a series of documents. Each document contains ONE recommendation and is linked to by the from the dosing collection by their ObjectID's. Other then the ID column there are no unique fields, or indexed fields in the drugRecommendation Collection. 

**default collection name:** drugRecommendations

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| drug | string | the drug the recommendation is applied to | no |
| genes | Array | Array of sorted gene names that the recommendation is dependant upon. Only if ALL of the genes are present does the recommendation apply | no |
| classes | Array | Array of Predicted effects that are sorted based upon the Gene sort order (ie. index 0 of classes is paired with the gene of index 0 from the genes array). Only if all the classes (and Genes) are present in the query does the recommendation apply | no |
| rec | String | The recommendation for the therapeutic class  and drug | no |
| risk | String |The associated risk for the given recommendation | no | 
| pubmed  | Array | Array consisting of pubmed ID's as strings | no |


```js
{
	"_id":ObjectId(),
	"drug": String,
	"genes" : [gene name],
	"classes" : [metabolic statuses],
	"rec": String,
	"risk": String,
	pubmed: [pubmed ID]
}
```

### Haplotypes
Each document corresponds to a single gene and allows easy retrieval of all information for that gene. It contains several arrays of identifiers which allow the server to easily retrieve information that is linked to the specified gene, as opposed to containing all of the informtion within the given array. This speeds up retrieval as it now uses indexed fields to find all of the associated documents as opposed to searching through a single document array.

 
**default collection name:** dosing


| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| gene | String | Unique Gene name | yes |
| type | String | One of four gene classes | no |
| haplotypes | Array| Array of OBjectID's pointing to a document in the haplotypes collection| no |
| recommendations | Array | Array of ObjectId's pointing to documents in the drugRecommendation collection | no |
| future | Array | Array of ObjectId's pointing to documents in the future collection | no |
| markers | Array | Array of marker ID's pointing to marker collections | no |


```js
{
	"_id" : ObjectId(),
	"gene" : String, // unique key
	"haplotypes" : [
		ObjectId()
	],
	"recommendations" : [
		ObjectId()
	],
	"future" : [
		ObjectId()
	],
	"markers":[
		String
	]
}
```

### Future
the future recommendation table consists of unsorted documents that are associated with a specific gene and a specific metabolic status. the ObjectID is used as a key to access specific documents. A recommendation is only ever applied to a SINGLE gene

**default collection:** future

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| gene | String | gene the recommendation is linked to | no |
| class | String | Metabolic status that the recommendation is linked to | no |
| rec | String | The actual recommendation for the specific gene and predicted effect combination | no |


```js
{
	"_id":ObjectId(),
	"gene" : String,
	"classes" : String,
	"rec": String
}
```

### Gene Descriptors
Every gene has a specified type, each document in this collection contains a single type and contains information on the Predicted effects that are associated with it

**default collection:** geneDescriptors


| **Field**  | **Type** | **Definition** | **Indexed** |
| _id | String | unique name for each descriptor | yes |
| classes | Array | An array of predicted effects associated with the current gene descriptor | no |
| definition | String | A summary definition of the type | no |
| fullname | String | Thee name that will appear to the user | no |

{
	"_id" : String,
	"classes" : [
		Predicted Effect
	],
	"definition" : String,
	fullname : String
}



