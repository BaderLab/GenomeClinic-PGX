/* Build webbapp from source-code and distribute to the proper
 * folder structure. Additionally offer the ability to make a clean
 * distribution and build by removing the current build directory
 * and all of its contents
 *
 * @Patrick Magee
*/

var gulp = require('gulp'),
	gutil = require('gulp-util'),
	plugins = require('gulp-load-plugins')()
	_ = require('lodash'),
	jshstylish = require('jshint-stylish'),
	Browserify = require('browserify'),
	source = require('vinyl-source-stream'),
	buffer = require('vinyl-buffer'),
	path = require('path'),
	runSequence = require('run-sequence'),
	path = require('path'),
	constants = require("./src/server/conf/constants.json");

var paths = require('./gulpconfig');

var DEBUG = gutil.env.type !== 'production'

/* Client side Tasks */
gulp.task('client-scripts',function(){
	var toBundle = function(arr,dest){
		return _.each(arr,function(src){
			var file = src.split('/').splice(-1)[0]
			return Browserify(src)
			.bundle()
			.pipe(source(file))
			.pipe( DEBUG ? gutil.noop():buffer() )
			.pipe( DEBUG ? gutil.noop():plugins.uglify()  )
			.pipe(gulp.dest(dest))
		});
	}

	return toBundle(paths.client.browserify.src,paths.client.browserify.dest)
});

gulp.task( 'client-upload',['client-upload-vendor'], function(){
	return Browserify(paths.client.uploader.src)
	.bundle()
	.pipe( source(paths.client.uploader.name))
	.pipe( DEBUG ? gutil.noop():buffer() )
	.pipe( DEBUG ? gutil.noop():plugins.uglify()  )
	.pipe( gulp.dest(paths.client.uploader.dest) )
});


gulp.task('client-upload-vendor',function(){
	return gulp.src(paths.client.uploader.vendor)
	.pipe( plugins.concat(paths.client.uploader.vendorName) )
	.pipe( plugins.uglify() )
	.pipe( gulp.dest(paths.client.uploader.vendorDest) )

})
//precompile templates into a single packages
gulp.task('client-templates',['client-partials'], function(){
	return Browserify(paths.client.templates.src)
	.bundle()
	.pipe( source(paths.client.templates.name))
	.pipe( buffer() )
	.pipe( plugins.uglify() )
	.pipe( gulp.dest(paths.client.templates.dest))
});

gulp.task('client-partials',function(){
	return gulp.src(paths.client.partials.src)
	.pipe( gulp.dest(paths.client.partials.dest) );
});

gulp.task('client-vendor',function(){
	return gulp.src(paths.client.vendorBundle.src)
	.pipe( plugins.concat(paths.client.vendorBundle.name) )
	.pipe( plugins.uglify() )
	.pipe( gulp.dest(paths.client.vendorBundle.dest) );
});

gulp.task('client-views',function(){
	return gulp.src(paths.client.views.src)
	.pipe(gulp.dest(paths.client.views.dest));
});

//CSS for the default report
gulp.task('client-report-css',function(){
	return gulp.src(paths.client.reportCss.src)
	.pipe( plugins.cssmin({'keepSpecialComments':0}))
	.pipe( gulp.dest(paths.client.reportCss.dest) );
});

//Minify Broswer CSS
gulp.task('client-css',['client-report-css'],function(){
	return gulp.src(paths.client.css.src)
	.pipe( plugins.cssmin({'keepSpecialComments':0}))
	.pipe( plugins.concat('bundle.min.css') )
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
	return runSequence('client-scripts','client-upload','client-templates','client-vendor','client-views','client-css','client-img','client-icon',next);
});


/* Server tasks to set up the server */
gulp.task('server-routes',function(){
	return gulp.src(paths.server.routes.src)
	.pipe( gulp.dest(paths.server.routes.dest));
});

gulp.task('server-conf', function(){
	return gulp.src(paths.server.conf.src)
	.pipe( gulp.dest( paths.server.conf.dest) );
});

gulp.task('server-cons',function(){
	var dir = path.resolve(__dirname + '/build');
	if (process.platform.search(/win[0-9]+/i) !== -1){
		dir = dir.replace(/\\/g,"\\\\");
	}
	return gulp.src(paths.server.cons.src)
	.pipe( plugins.replace(/\{\{DIR\}\}/g, dir) )
	.pipe( gulp.dest(paths.server.cons.dest) );
});

gulp.task('server-lib',function(){
	return gulp.src(paths.server.lib.src)
	.pipe( gulp.dest(paths.server.lib.dest) );
});

gulp.task('server-models',function(){
	return gulp.src(paths.server.model.src)
	.pipe(plugins.replace(/\{\{DBVERSION\}\}/g,paths.server.dbVersion))
	.pipe( gulp.dest(paths.server.model.dest) );
});

gulp.task('server-app',function(){
	return gulp.src(paths.server.app.src)
	.pipe( plugins.rename( paths.server.app.name) )
	.pipe( gulp.dest( paths.server.app.dest) );
});

gulp.task('server-bulk',function(){
	return gulp.src(paths.server.bulkops.src)
	.pipe ( gulp.dest( paths.server.bulkops.dest ) );
});

gulp.task("server-error",function(){
	return gulp.src(paths.server.error.src)
	.pipe( gulp.dest(paths.server.error.dest) );
});

gulp.task('server',function(next){
	return runSequence('server-routes','server-conf','server-app','server-lib','server-cons','server-models','server-bulk','server-error',next);
});

/* Generic Tasks */

//gulp.task('bower',function(){
//	return plugins.bower()
//});

gulp.task('jshint',function(){
	return gulp.src(paths.jshint)
		.pipe(plugins.jshint())
		.pipe(plugins.jshint.reporter(jshstylish));
});

gulp.task('prewatch', ['jshint'], function(next){
	return runSequence('client','server',next);
});


/* enter into a watch loop */
gulp.task('watch',['prewatch'], function(next){
	gulp.watch('./gulpfile.js',['client','server']);
	gulp.watch('src/client/**/*',['client']);
	gulp.watch('src/server/**/*',['server']);
});


/* default task to run when gulp command is given */
gulp.task('default',function(next){
	return runSequence('client','server',next);

});

/* clean the build directory */
gulp.task('clean',function(){
	return gulp.src(['build'])
	.pipe(plugins.clean({read:false}));
});
