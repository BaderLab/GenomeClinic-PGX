/* Build webbapp from source-code and distribute to the proper
 * folder structure. Additionally offer the ability to make a clean
 * distribution and build by removing the current build directory
 * and all of its contents
 *
 * @Patrick Magee
*/

var gulp = require('gulp'),
	gutil = require('gulp-util'),
	uglify = require('gulp-uglify'),
	cssmin = require('gulp-cssmin'),
	jshint = require('gulp-jshint'),
	concat = require('gulp-concat'),
	rename = require('gulp-rename'),
	clean = require('gulp-clean'),
	jshstylish = require('jshint-stylish'),
	browserify = require('browserify'),
	source = require('vinyl-source-stream'),
	buffer = require('vinyl-buffer'),
	path = require('path'),
	sourcemap = require('gulp-sourcemaps'),
	runSequence = require('run-sequence'),
	replace = require('gulp-replace'),
	path = require('path'),
	exec = require('child_process').exec,
	constants = require("./src/server/conf/constants.json");


/* all paths for use */
var paths = {
	client:{
		browserify:{
			src:'./src/client/javascript/index.js',
			name:'bundle.js',
			min:'bundle.min.js',
			dest:'build/public/js'
		},
		vendorBundle:{
			src:[
				'src/client/javascript/lib/jquery.js',
				'src/client/javascript/lib/foundation.min.js',
				],
			name:'vendor.bundle.min.js',
			dest:'build/public/js/vendor'
		},
		modernizr:{
			src:'src/client/javascript/lib/modernizr.js',
			dest:'build/public/js/vendor'
		},
		views:{
			src:[
				'src/client/templates/layout.hbs',
				'src/client/templates/pgx-report.hbs',
				'src/client/templates/default-dosing-report.hbs'
				],
			dest:'build/views'
		},
		css:{
			src:[
				'src/client/css/app.css',
				'src/client/css/foundation.min.css'
				],
			dest:'build/public/css'
		},
		reportCss:{
			src:'src/client/css/pgx-report.css',
			dest:'build/public/css'
		},
		img:{
			src:'src/client/images/**/*.*',
			dest:'build/public/img'
		},
		icon:{
			src:'src/client/icons/**/*.*',
			dest:'build/public/icons'
		},
	},
	server:{
		app:{
			src:'src/server/src/server.js',
			name:'webapp.js',
			dest:'build'
		},
		routes:{
			src:'src/server/routes/*.js',
			dest:'build/controllers'
		},
		lib:{
			src:[
				'src/server/src/anno_logger.js',
				'src/server/src/annotateAndAddVariants.js',
				'src/server/src/logger.js',
				'src/server/src/parseVCF.js',
				'src/server/src/queue.js',
				'src/server/src/utils.js',
				'src/server/src/genReport.js'
			],
			dest:'build/lib'
		},
		conf:{
			src:[
				'src/server/conf/api.js',
				'src/server/conf/pgx*',
				'src/server/conf/dosing_guidelines.json',
				'src/server/conf/therapeutic_classes.json'
			],
			dest:'build/lib/conf'
		},
		cons:{
			src:'src/server/conf/constants.json',
			dest:'build/lib/conf'
		},
		model:{
			src:'src/server/src/mongodb_functions.js',
			dest:'build/models'
		}
	},
	jshint:[
		'src/server/**/*.js',
		'src/client/javascript/*.js',
		'src/client/config/*.json'
	]
};


//Clean the build directory

gulp.task('clean',function(){
	return gulp.src(['build'])
	.pipe(clean({read:false}));
});


gulp.task('default',['build'],function(){

});

gulp.task('build',['watch'],function(){

});


gulp.task('client-js',function(){
	return browserify(paths.client.browserify.src,{debug:true})
		.bundle()
		.pipe( source(paths.client.browserify.min) )
		.pipe( gutil.env.type==='production' ? buffer():gutil.noop() )
		.pipe( gutil.env.type==='production' ? uglify():gutil.noop()  )
		.pipe( gulp.dest(paths.client.browserify.dest) );
});
gulp.task('client-modernizr',function(){
	return gulp.src(paths.client.modernizr.src)
	.pipe( gulp.dest(paths.client.modernizr.dest) );
});

gulp.task('client-views',function(){
	return gulp.src(paths.client.views.src)
	.pipe(gulp.dest(paths.client.views.dest));
});

gulp.task('client-vendor', ['client-modernizr'],function(){
	return gulp.src(paths.client.vendorBundle.src)
	.pipe( concat(paths.client.vendorBundle.name) )
	.pipe( uglify() )
	.pipe( gulp.dest(paths.client.vendorBundle.dest) );
});

gulp.task('client-report-css',function(){
	return gulp.src(paths.client.reportCss.src)
	.pipe( gulp.dest(paths.client.reportCss.dest) );
});
gulp.task('client-css',['client-report-css'],function(){
	return gulp.src(paths.client.css.src)
	.pipe( gutil.env.type==='production' ? cssmin({'keepSpecialComments':0}):gutil.noop())
	.pipe( concat('bundle.min.css') )
	.pipe(gulp.dest(paths.client.css.dest));
});

gulp.task('client-img',function(){
	return gulp.src(paths.client.img.src)
	.pipe(gulp.dest(paths.client.img.dest));
});

gulp.task('client-icon',function(){
	return gulp.src(paths.client.icon.src)
	.pipe(gulp.dest(paths.client.icon.dest));
});

gulp.task('client',function(next){
	runSequence('client-js','client-views','client-vendor','client-css','client-img','client-icon',next);
});

gulp.task('server-routes',function(){
	return gulp.src(paths.server.routes.src)
	.pipe( gulp.dest(paths.server.routes.dest));
});

gulp.task('server-conf', ['server-lib','server-models','server-cons'], function(){
	return gulp.src(paths.server.conf.src)
	.pipe( gulp.dest( paths.server.conf.dest) );
});

gulp.task('server-cons',function(){
	var dir = path.resolve(__dirname + '/build');
	if (process.platform.search(/win[0-9]+/i) !== -1){
		dir = dir.replace(/\\/g,"\\\\");
	}
	return gulp.src(paths.server.cons.src)
	.pipe( replace(/\{\{DIR\}\}/g, dir) )
	.pipe( gulp.dest(paths.server.cons.dest) );
});

gulp.task('server-lib',function(){
	return gulp.src(paths.server.lib.src)
	.pipe( gulp.dest(paths.server.lib.dest) );
});

gulp.task('server-models',function(){
	return gulp.src(paths.server.model.src)
	.pipe( gulp.dest(paths.server.model.dest) );
});

gulp.task('server-app',['server-conf'],function(){
	return gulp.src(paths.server.app.src)
	.pipe( rename( paths.server.app.name) )
	.pipe( gulp.dest( paths.server.app.dest) );
});


gulp.task('server',function(next){
	runSequence('server-routes','server-conf','server-app',next);
});


//Added route for globally installing phantomJs dependency
gulp.task("phantom",function(){
	var cont = true;
	var platform = process.platform;
	console.log(platform);
	if (platform.search(/win[0-9]+/i) === -1){
		var uid = process.getuid();
		if (uid !== 0){
			gutil.log(gutil.colors.bgRed("Error:"), gutil.colors.yellow("PhantomJS"), "requires root privliges to be installed...");
			gutil.log(gutil.colors.bgRed("Error:"), gutil.colors.yellow("PhantomJS"), "Please run gulp with root privelege or manually install...");
			gutil.log(gutil.colors.bgRed("Error:"), gutil.colors.yellow("PhantomJS"), "Skipping installation...");
			cont = false;
		}
	}
	if (cont){
		gutil.log(gutil.colors.bgGreen("Starting:"), gutil.colors.yellow("PhantomJS"),"Installation Starting");
		exec('npm install -g phantomjs',function(err,stdout,stderr){
			if (err)
				gutil.log(gutil.colors.bgRed("Error:"), gutil.colors.yellow("PhantomJS"),"Install failed");
			else if (stderr)
				gutil.log(gutil.colors.bgRed("Error:"), gutil.colors.yellow("PhantomJS"),"Install failed");
			else 
				gutil.log(gutil.colors.bgGreen("Success:"), gutil.colors.yellow("PhantomJS"),"Successfully installed");
		});
	}
});

gulp.task('jshint',function(){
	if (gutil.env.type !== 'production'){
		return gulp.src(paths.jshint)
		.pipe(jshint())
		.pipe(jshint.reporter(jshstylish));
	}
});

gulp.task('prewatch', ['jshint'], function(){
	runSequence('phantom','client','server');
});

gulp.task('watch',['prewatch'], function(){
	if (gutil.env.type !== 'production'){
		gulp.watch('src/client/**/*',['client']);
		gulp.watch('src/server/**/*',['server']);
	}
});

