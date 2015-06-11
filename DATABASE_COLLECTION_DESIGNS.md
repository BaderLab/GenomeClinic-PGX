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
| annovar-path | String | Path to the annovar executable | no |
| genome-build | String | Current Genome build being used for alignment ex. hg19 | no|
| max-query-records | Number | Deprecated | no |
| report-footer | String | Generic disclaimer used on the bottom of reports | no | 
| annovar-dbs  | Array | List of databases to use when annotating the variant file |no |
| annovar-usage | Array | List of usage for the each database ex. g/f|  no| 
| annovar-index | array | which annotations should be indexed after they have been uploaded | no |

```js
{
	"_id" : ObjectId(),
	"curr_patient_index" : Number,
	"curr_panel_index" : Number,
	"config" : Boolean,
	"institution" : String,
	"admin-email" : email,
	"annovar-path" : Path,
	"genome-build" : String,
	"max-query-records" : Number,
	"report-footer" : String,
	"annovar-dbs" : [],
	"annovar-usage" : [],
	"annovar-index" : []
}
```

### Users Collection 
Information specific to each user. Currently this field is underutilized and does not really have any use beyond logging in and out

**Default Collection Name:** users


| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
|username | String | Unique email for each user | yes |
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
|_id | ObjectId | Unique document Id | yes |
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
2015-05-12 15:51:37


### Individual Patient Collection
Each patient has an individual patient collection assigned to them when they are uploaded. This contains all of the information from the annotate vcf file, each document in this collection corresponds to a single entry in the .vcf file. The number assigned to the patient collections is found in admin.curr_patient_index and is incremented each time a patient is added.

**Default Collection Name:** p(number);

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| chr | String | Chromosome | yes |
| pos | Number | Position of variant | yes | 
| id | string | rsID of the Variant if any | yes |
| ref | String | Reference Allele for this position | no |
| alt | Array | Array of alternate alleles for this position | no |
| original_alt | String | Original alternate allele prior to shifting position | no |
| original_ref | String | Original reference allele prior to shifting position | no |
| original_pos | String | Original position prior to shifting | no |
| zygosity | String | Based on the genotype is the user homo_ref homo_alt or heter | yes | 
| gt-raw | String | Raw genotype with phasing status recorded in vcf file | no |
| gt | Array | Genotype of the patient, first index  is ref, second is alt | no |
| phased_status | Bool | Whether the information is phased or not | no |

```js
{
	"_id" : ObjectId(),
	"chr" : String,
	"pos" : Number,
	"id" : string,
	"ref" : String,
	"alt" : String,
	"original_alt" : String,
	"original_ref" : String,
	"original_pos" : Number,
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
Each document in this collection corresponds to a single marker used in the PGX analysis and has information on the position and alleles for that marker.

**Default Collection Name:** pgxCoordinates

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| id | String | Unique rsID corresponding to the rsID's in dbSNP | yes |
| alt | Array | Expected alternate alleles | no |
| ref | String | Reference allele | no |
|chr | String | Chromosome the marker is situated on | no |
| pos| Number | Base position of the marker on the chromosome |no |


```js
{
	"_id" : ObjectId(),
	"id" : String,
	"alt" : Array,
	"chr" : String,
	"pos" : Number,
	"ref" : String
}
```


### PGx Genes Collection
Each document corresponds the a gene. Each gene has information on the haplotypes for that gene, and the markers associated with the haplotype

**Default Collection Name:** pgxGenes

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
|gene| String | Unique gene name that the haplotypes apply to | yes |
| haplotypes| Object | Object containing information on all the haplotypes, the keys of the object are the haplotypes themselves | no |
| HAPLOTYPE_NAME | Array | HAPLOTYPE_NAME is substituted for the actual haplotype name with its value set to an array of marker ID's. the ID's correspond to ids in the pgx Marker Collection | no | 


```js
{
	"_id" : ObjectId(),
	"gene" : String,
	"haplotypes" : {
		"HAPLOTYPE_NAME" : Array
	}
}
```


### Therapeutic Classes


### Dosing recommendation collection
The Dosing recommendation collection consists of entries corresponding to a single unique gene name. It contains arrays of IDs that link to the attributed recommendations, future considerations and haplotypes. Editing the array of ID's will either associate or dissociate an entry with the gene.
 
**default collection name:** dosing


| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| gene | String | Unique Gene name | yes |
| haplotypes | Array| Array of OBjectID's pointing to a document in the haplotypes collection| no |
| recomendations | Array | Array of ObjectId's pointing to documents in the drugRecomendation collection | no |
| future | Array | Array of ObjectId's pointing to documents in the future collection | no |


```js
{
	"_id" : ObjectId(),
	"gene" : String, // unique key
	"haplotypes" : [
		ObjectId()
	],
	"recomendations" : [
		ObjectId()
	],
	"future" : [
		ObjectId()
	]
}
```

### Drug Recommendations
The drugReceomendation collection consists of all of a series of documents. Each document contains ONE recommendation and is linked to by the from the dosing collection by their ObjectID's. Other then the ID column there are no unique fields, or indexed fields in the drugRecomendation Collection. 

**default collection name:** drugRecomendations

| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| drug | string | the drug the recommendation is applied to | no |
| genes | Array | Array of sorted gene names that the recommendation is dependant upon. Only if ALL of the genes are present does the recommendation apply | no |
| classes | Array | Array of Metabolic Status that are sorted based upon the Gene sort order (ie. index 0 of classes is paired with the gene of index 0 from the genes array). Only if all the classes (and Genes) are present in the query does the recommendation apply | no |
| rec | String | The recommendation for the therapeutic class  and drug | no |
| risk | String |The associated risk for the given recommendation | no | 
| pubmed  | Array | Array consisting of pubmed ID's as strings | no |


```js
{
	"_id":ObjectId(),
	"drug": String,
	"genes" : [<gene name >],
	"classes" : [<metabolic statuses>],
	"rec": String,
	"risk": String,
	pubmed: [<pubmed ID>]
}
```

### Haplotypes
the haplotypes collection consists of unsorted documents that can be linked to a specific genes. Each document has a pair of sorted haplotypes and metabolic status attributed to it, as well as a gene that it can be applied to.

**default collection name:** haplotypes


| **Field**  | **Type** | **Definition** | **Indexed** |
|:------------|:-----:|:------------|:------:|
|_id | ObjectId | Unique document Id | yes |
| gene | String | Unique Gene name | yes |
| class | String | Metabolic status that is associated with the haplotype pair | no |
| haplotypes | Array | Array with length 2 consisting of a sorted haplotype pair | no |


```js
{
	"_id":ObjectId(),
	"gene" : String,
	"class" : String,
	"haplotypes": [
		<haplotype 1>,
		<haplotype 2>
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
| rec | String | The actual recommendation for the specific gene and metabolic status combination | no |


```js
{
	"_id":ObjectId(),
	"gene" : String,
	"classes" : String,
	"rec": String
}
```




