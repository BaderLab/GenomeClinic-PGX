var gulp = require('gulp'),
	gutil = require('gulp-util'),
	uglify = require('gulp-uglify'),
	cssmin = require('gulp-cssmin'),
	jshint = require('gulp-jshint'),
	concat = require('gulp-concat'),
	rename = require('gulp-rename'),
	jshstylish = require('jshint-stylish'),
	browserify = require('browserify'),
	source = require('vinyl-source-stream'),
	buffer = require('vinyl-buffer'),
	path = require('path'),
	sourcemap = require('gulp-sourcemaps'),
	runSequence = require('run-sequence');

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
			src:'src/client/templates/layout.hbs',
			dest:'build/views'
		},
		css:{
			src:'src/client/css/**/*.*',
			dest:'build/public/css'
		},
		img:{
			src:'src/client/images/**/*.*',
			dest:'build/public/img'
		},
		icon:{
			src:'src/client/icons/**/*.*',
			dest:'build/public/icons'
		}
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
				'src/server/src/utils.js'
			],
			dest:'build/lib'
		},
		conf:{
			src:[
				'src/server/conf/constants.json',
				'src/server/conf/pgx_haplotypes.json'
			],
			dest:'build/lib/conf'
		},
		model:{
			src:'src/server/src/mongodb_functions.js',
			dest:'build/models'
		}
	}
};


gulp.task('default',['build'],function(){

});

gulp.task('build',['watch'],function(){

});


gulp.task('client-js',function(){
	return browserify(paths.client.browserify.src,{debug:true})
		.bundle()
		.pipe( source(paths.client.browserify.min) )
		//.pipe( buffer() )
		//.pipe( uglify() )
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

gulp.task('client-css',function(){
	return gulp.src(paths.client.css.src)
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

gulp.task('server-conf', ['server-lib','server-models'], function(){
	return gulp.src(paths.server.conf.src)
	.pipe( gulp.dest( paths.server.conf.dest) );
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
	.pipe( gulp.dest( paths.server.app.dest) )
});


gulp.task('server',function(next){
	runSequence('server-routes','server-conf','server-app',next);
});

gulp.task('jshint',function(){
	return gulp.src("./src/**/*.js")
	.pipe(jshint())
	.pipe(jshint.reporter(jshstylish));
});

gulp.task('prewatch', ['jshint'], function(){
	runSequence('client','server');
});

gulp.task('watch',['prewatch'], function(){
	gulp.watch('src/client/**/*',['client']);
	gulp.watch('src/server/**/*',['server']);
});