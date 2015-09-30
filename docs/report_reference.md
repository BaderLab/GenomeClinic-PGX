## Reference for Creating Custom reports

Reports are built by using a standard template designed with Handlebars.js which is then rendered into an html output. The output is then read by PhantomJs, a headless webkit, that is able to load the page resources and render the page as a pdf document. The server passes an object from the client to the rendering agent containing all the information requried to generate the report.


### Building custom reports

HandlebarsJS templates look very similar to a standard html markup and are incredibly easy to create. You include all the same information, inclduing CSS, images and even scripts (although by default phantomjs is not set up currently to execute javascript) within the handlebars files. Areas where handlebars is supposed to inject information are denoted by `{{ }}` and are subjected to various control elements that handlbars uses. Every report is given the same inforamtion from the client that can be incorperated into the report.

Using the custom report is as easy as passing a single command-line argument at server startup. Simply set the `--report` flag and pass the path of the tempate to the server.

example

```js
node webapp.js --report ./path/to/report.hbs
```

### Report Object Properties

- `Obj.patient` : Object with information on the patient
	- `Obj.patient.name`: Object with patients name
		- `Obj.patient.name.first` : String of patients first name
		- `Obj.patient.name.last` : String of patients last name
	- `Obj.patient.mrn`: String consisting of the unique identifer for the patient
	- `Obj.patient.dob`: Object consisting of the patient Date of birth
		- `Obj.patient.dob.date` : String of patients date of birth
		- `Obj.patient.dob.month` : String of patients month of birth
		- `Obj.patient.dob.year` : String of patients year of birth
	- `Obj.patient.sex`: String of patients sex either Male /  Female or M/F
	- `Obj.patient.age`: Patients age
	- `Obj.patient.weight` : String of patients Weight
	- `Obj.patient.height` : String of patients Height
	- `Obj.patient.sampletype` : String of sampletype of the patient
	- `Obj.patient.reason` : String of the reason for testing the patient
- `Obj.dr` : Object with information on the physician
	- `Obj.dr.name` : An array of the Dr's Name
		- `Obj.dr.name.first` : String of the Doctors first name
		- `Obj.dr.name.last` : String of the Doctors last name
	- `Obj.dr.address` : String of the Doctors Addres
	- `Obj.dr.city` : String of the Doctors City
	- `Obj.dr.region` :  String of the Doctors Province or state
	- `Obj.dr.postal` : String of the Doctors Postal Code
- `Obj.summary` : String of the report summary
- `Obj.drugsOfInterest` : array cantaining drugs of interest for the patient. Each item in the array a string of the drug name.
- `Obj.citations` : Array of Citation objects.
	- `Obj.citations[n].index` : Integer of the number that the current citation shows up in the final list
	- `Obj.citations[n].citation` : String consisting of a formatted citation
- `Obj.recommendations` : Array consisting of recommendations
	- `Obj.recommendations[n].drug` : String of the drug name
	- `Obj.recommendations[n].genes` : Array of genes associated with the recommendation
	- `Obj.recommendations[n].classes`: Array of the classes for the recommednation. Each entry corresponds to the entry of each gene
	- `Obj.recommendations[n].pubmed` : Array of pubmedId's
	- `Obj.recommendations[n].rec` : String of the recommendation
	- `Obj.recommendations[n].pubmedString` : String consisting of reference to the citaitons included in the recommendation
- `Obj.future` : Array consisting of Future considerations
	- `Obj.future[n].rec` : String of the recommendation
	- `Obj.future[n].classes` : Array of classes associated with the future recommendation
	- `Obj.future[n].genes` : Array genes associated with the future recommmendation
- `Obj.genes` : Array of genes
	- `Obj.genes[n].gene` : String of the gene name
	- `Obj.genes[n].haplotype` : Array of the haplotyes that were used for the recommendations
	- `Obj.genes[n].class` : Predictor of effect
- `Obj.flagged` : Indicates wether any data has been flagged
- `Obj.disclaimer` : report disclaimer




