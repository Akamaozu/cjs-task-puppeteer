var puppeteer = require('puppeteer');

module.exports = function( task, config ){
  if( ! config ) config = {};

  config.headless = config.hasOwnProperty( 'headless' ) ? config.headless : true;
  config.load_images = config.hasOwnProperty( 'load_images' ) ? config.load_images : false;
  config.ignore_ssl_errors = config.hasOwnProperty( 'ignore_ssl_errors' ) ? config.ignore_ssl_errors : true;
  config.no_sandbox = config.hasOwnProperty( 'no_sandbox' ) ? config.no_sandbox : true;
  config.disable_setuid_sandbox = config.hasOwnProperty( 'disable_setuid_sandbox' ) ? config.disable_setuid_sandbox : true;
  config.disable_dev_shm_usage = config.hasOwnProperty( 'disable_dev_shm_usage' ) ? config.disable_dev_shm_usage : true;
  config.disable_accelerated_2d_canvas = config.hasOwnProperty( 'disable_accelerated_2d_canvas' ) ? config.disable_accelerated_2d_canvas : true;
  config.disable_gpu = config.hasOwnProperty( 'disable_gpu' ) ? config.disable_gpu : true;

  // determine logging verbosity
    var set_logging_verbosity = false;

    if( ! set_logging_verbosity && config.hasOwnProperty( 'verbose' ) ){
      config.verbose = config.verbose;
      set_logging_verbosity = true;
    }

    if( ! set_logging_verbosity && process.env.hasOwnProperty( 'BROWSER_VERBOSE_LOGGING' ) ){
      config.verbose = process.env.BROWSER_VERBOSE_LOGGING.toLowerCase().trim() !== 'false';
      set_logging_verbosity = true;
    }

    if( ! set_logging_verbosity && process.env.hasOwnProperty( 'VERBOSE_LOGGING' ) ){
      config.verbose = process.env.VERBOSE_LOGGING.toLowerCase().trim() !== 'false';
      set_logging_verbosity = true;
    }

    if( ! set_logging_verbosity ) config.verbose = true;

  task.step( 'start puppeteer', function(){
    var puppeteer_launch_args = [];

    if( config.no_sandbox ) puppeteer_launch_args.push( '--no-sandbox' );
    if( config.disable_setuid_sandbox ) puppeteer_launch_args.push( '--disable-setuid-sandbox' );
    if( config.disable_dev_shm_usage ) puppeteer_launch_args.push( '--disable-dev-shm-usage' );
    if( config.disable_accelerated_2d_canvas ) puppeteer_launch_args.push( '--disable-accelerated-2d-canvas' );
    if( config.disable_gpu ) puppeteer_launch_args.push( '--disable-gpu' );

    puppeteer.launch({
      ignoreHTTPSErrors: config.ignore_ssl_errors,
      args: puppeteer_launch_args,
      headless: config.headless,
      defaultViewport: null
    })
      .then( function( browser ){
        if( config.verbose ) console.log( ' - [browser] started' );
        task.set( 'browser', browser );
        return browser.newPage();
      })
      .then( function( page ){
        if( config.verbose ) console.log( ' - [browser][page] started' );
        task.set( 'browser-page', page );
        return page;
      })
      .then( function( page ){

        // shim page invokeMethod from phantomjs
        // - need to create step for executing code on page in future
        page.invokeMethod = function( method ){
          switch( method ){

            case 'evaluate':
              var args = Array.prototype.slice.call( arguments );
              args.shift();

              return page.evaluate.apply( page, args );
            break;

            default:
              var error_msg = 'no current mapping for browser method "' + method + '"';
              console.log( ' - [browser][error] ' + error_msg );

              throw new Error( error_msg );
            break;
          }
        }

        // shim page property from phantomjs
        page.property = function( method ){
          switch( method ){

            case 'url':
              return new Promise( function( resolve, reject ){
                resolve( page.url() );
              });
            break;

            default:
              var error_msg = 'no current mapping for browser property "' + method + '"';
              console.log( ' - [browser][error] ' + error_msg );

              throw new Error( error_msg );
            break;
          }
        }

        // run next task step on new page loads
        var task_control_stack = [ task ];

        page.control_task = function( task_to_control, maybe_current_controller ){
          if( ! task_to_control ) throw new Error( 'no task to control specified' );

          var current_controller = task_control_stack.length > 0 ? task_control_stack[ task_control_stack.length - 1 ] : null;

          if( current_controller ){
            if( task_to_control === current_controller ) return;

            if( ! maybe_current_controller ) throw new Error( 'current control task was not specified' );
            if( maybe_current_controller !== current_controller ) throw new Error( 'incorrect control task given' );
          }

          task_control_stack.push( task_to_control );

          var current_control_task = task_to_control;

          current_control_task.hook.add( 'task-end', 'browser-auto-release-control-task', function(){
            page.release_task( current_control_task );
          });
        }

        page.release_task = function( task_to_release ){
          if( ! task_to_release ) return;
          if( task_control_stack.length < 1 ) return;

          var current_controller = task_control_stack[ task_control_stack.length - 1 ];
          if( task_to_release != current_controller ) throw new Error( 'task to release is not current control task' );

          var released_task = task_control_stack.pop();

          released_task.hook.delete( 'task-end', 'browser-auto-release-control-task' );
        }

        page.on( 'domcontentloaded', function(){
          if( config.verbose ) console.log( ' - [browser][page] navigated to "' + page.url() + '"' );

          var task_to_progress = task_control_stack[ task_control_stack.length - 1 ];
          if( task_to_progress ) task_to_progress.next();
        });

        // pipe page logs
        page.on( 'console', function(){
          if( ! config.show_console_output ) return;

          var args = Array.prototype.slice.call( arguments );
          args.unshift( ' - [browser][page][console]' );
          console.log.apply( console, args );
        });

        page.on( 'request', function( request ){
          if( task_control_stack.length < 1 ) return;
          if( ! request.isNavigationRequest() || request.frame() !== page.mainFrame() ) return;

          var control_task = task_control_stack[ task_control_stack.length - 1 ];

          control_task.set( 'last-browser-request', request );
          control_task.hook.run( 'browser-request', request );
        });

        page.on( 'response', function( response ){
          if( task_control_stack.length < 1 ) return;

          var initiating_request = response.request(),
              control_task = task_control_stack[ task_control_stack.length - 1 ];

          var last_request = control_task.get( 'last-browser-request' );
          if( ! last_request || ! initiating_request || last_request !== initiating_request ) return;

          control_task.set( 'last-browser-response', response );
          control_task.hook.run( 'browser-response', response );
        });

        return page;
      })
      .then( task.next )
      .catch( function( e ){
        throw e;
      });
  });
}