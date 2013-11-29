/*
 * @author kay warrie
 * (c) Copyright 2012 kay warrie. All Rights Reserved. 
 */
dojo.require("esri.map");
dojo.require("esri.layers.KMLLayer");
dojo.require("esri.arcgis.utils");
dojo.require("esri.dijit.Scalebar");
dojo.require("esri.dijit.Popup");
dojo.require("esri.layers.graphics");
dojo.require("esri.layers.osm");
dojo.require("dojox.mobile.parser");
dojo.require("dojox.mobile");
dojo.require("dojox.mobile.Button");
dojo.requireIf(!dojo.isWebKit, "dojox.mobile.compat");
dojo.require("dojo.date.locale");
 
var map, layer , kmlprops;
var mapactive = 1;



function init() {
	
		esri.config.defaults.io.proxyUrl = 'http://kaywarrie.com/cgi/proxy.php'
		
		//onorientationchange doesn't always fire in a timely manner in Android so check for both orientationchange
		var supportsOrientationChange = "onorientationchange" in window, orientationEvent = supportsOrientationChange ? "orientationchange" : "resize";

		if( esri.isTouchEnabled ){
			window.addEventListener("orientationchange", function() {
			orientationChanged();  }, false);
		}
		
		//the map	
		var initExtent = new esri.geometry.Extent({"xmin":467840,"ymin":6646858,"xmax":507587,"ymax":6687675,"spatialReference":{"wkid":102100}});
		var popup = new esri.dijit.Popup(null, dojo.byId("popupDiv"));	
		map = new esri.Map("map", {logo:false, showAttribution:false, slider:false, infoWindow:popup, extent: initExtent } );
		dojo.connect(map, "onLoad", initFunc);
		
		dojo.connect(popup,"onHide",function(){
    			if( layer && layer.clearSelection ){ layer.clearSelection(); }    			
  		});
		
		dojo.connect( map  ,"onClick",function(){
    			map.infoWindow.hide()  ;			
  		});
		
		
		//basiskaart
		var ortho = new esri.layers.ArcGISTiledMapServiceLayer(
			"http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer", {id:"ortho", visible: false});
		var osm = new esri.layers.OpenStreetMapLayer({id: "OSM", visible: true});
		ortho.hide();
        map.addLayer(ortho);  
        map.addLayer(osm);
		
		dojo.connect(map, 'onLoad', function(theMap) {
            var scale = new esri.dijit.Scalebar({
            map: map,
            scalebarUnit:'metric'
			});
          
          dojo.connect( dijit.byId('view1') , 'resize', map, function () {
            	if(mapactive){  map.resize(); }
            });
        });
		loadlayer();
	}

//layerprops	
function loadlayer () {
	var uriparams = getparams();
	var Url; 
	if ( uriparams && uriparams.kml ){
		Url = uriparams.kml ;//"http://api.antwerpen.be/v1/geografie/grenzendistrict.kml" ;
		if("datatitle" in uriparams) { kmlhandler( Url , uriparams.datatitle ) }
		else { kmlhandler( Url , "eigenschappen" )}
	    }
	
	else if (  uriparams && uriparams.odjson ) {
		Url =  uriparams.odjson ;
		var title = uriparams.datatitle;
		odjsonhandler(  Url, title  )
	   }
	  
	else { dojo.style(dojo.byId('status'), 'display', 'none');  }				
	}

function odjsonhandler ( Url, title  ) {
	 var requestHandle = esri.request({
				url: Url ,  //"http://api.antwerpen.be/v1/infrastructuur/papiermand.jsonp", //
				callbackParamName: "callback",
				load: requestSucceeded,
				error: requestFailed
			});
			
	 function requestSucceeded(response, io) {
			      var data = response;

			      var wgs = new esri.SpatialReference( 4326 );
			      var x, y , latlng;
			      
			      //featlyr
			      var featureCol = {
				          "layerDefinition": null,
				          "featureSet": {
				            "features": [],
				            "geometryType": "esriGeometryPoint"
				          }
				        };
			      
			      featureCol.layerDefinition = {
					          "geometryType": "esriGeometryPoint",
					          "objectIdField": "id",   
					          "fields": []
					        };         
				  var features = [];	      

        		  kmlprops = dojo.map( data[ title ] , function(p,i) {

        		    if ( "geometry" in p ) {
        		  		var geo = JSON.parse(  p.geometry );

        		  		if ( geo.type == "Polygon" ){
        		  			var polygonJson  = {"rings": geo.coordinates ,"spatialReference":{" wkid":4326 }};
        		  			latlng =  new esri.geometry.Polygon(polygonJson);
        		  			
        		  			delete p.geometry ;
        		  			
        		  			featureCol.featureSet.geometryType = "esriGeometryPolygon";
        		  			featureCol.layerDefinition.geometryType = "esriGeometryPolygon";
        		  			}
        		  		else if ( geo.type == "MultiPolygon" ) {
        		  			var polygonJson  = {"rings": geo.coordinates[0] ,"spatialReference":{" wkid":4326 }};
        		  			latlng =  new esri.geometry.Polygon(polygonJson);
        		  			
        		  			delete p.geometry ;
        		  			
        		  			featureCol.featureSet.geometryType = "esriGeometryPolygon";
        		  			featureCol.layerDefinition.geometryType = "esriGeometryPolygon";
        		  			}
        		  		}
        		  	else {
	        		  	if( "gisx" in p && "gisy" in p  ){
	        		  		x = parseFloat( p["gisx"]);
	        		  		y = parseFloat( p["gisy"]);
	        		  		}
	        		  	else if ( "point_lng" in p && "point_lat" in p ){
	        		  		x = parseFloat( p["point_lng"]);
	        		  		y = parseFloat( p["point_lat"]);
	        		  		}
	        		  	else if ( "lng" in p && "lat" in p ){
	        		  		x = parseFloat( p["lng"]);
	        		  		y = parseFloat( p["lat"]);
	        		  		}
	        		  	  latlng = new esri.geometry.Point( x , y , wgs);   	  
        		  		}
          			
          			var webMercator = esri.geometry.geographicToWebMercator(latlng);
					
					p.id = i;
					
					var graphic = new esri.Graphic( webMercator ,null, p );          			

          			features.push(graphic);
          			
          			return  p ;
        			});
 
        		  var velden = Object.keys( features[0].attributes );
        		  featureCol.layerDefinition.fields = dojo.map( velden , function  (veld) {
        		  	var t;
					if (  veld == "id"  ) { t =  "esriFieldTypeOID" }
					else { t = "esriFieldTypeString" }
					
					return	{  "name": veld ,  "alias": veld,  "type": t  }
				  } );
        		  
        		  layer = new esri.layers.FeatureLayer(featureCol);
        		  
        		  map.addLayers([layer]);
        		  setSymbols( layer );
        		  layer.applyEdits(features, null, null); 
        		  
        		  			        		  
        		  var fields = getKmlExtraFields ( layer );
        		  
        		  var columns = dojo.map( fields , function(item) {
			    		return { field: item, label: item };
			    	});
			    	
			      makegrid( columns );
        		  
        		  setPopup( fields , title );
			      dojo.style(dojo.byId('status'), 'display', 'none');
    		}

	 function requestFailed(error, io) {
     			 console.log("Failed: ", error);
     			 dojo.style(dojo.byId('status'), 'display', 'none');
    		} 
		  
	}
		
function kmlhandler (kmlurl , title) {
	var kml = new esri.layers.KMLLayer(kmlurl);
	map.addLayer(kml); 

   	dojo.connect(kml, 'onLoad', function() {
   		dojo.style(dojo.byId('status'), 'display', 'none'); //make #status invisible
   		if( kml.getLayers().length >= 1 ){
	   			layer = kml.getLayers()[0];
				
				//symbols
	  		    setSymbols( layer );
	  		    
	     		//table
	     		kmlprops = dojo.map( layer.graphics, function(g) {
			        return g.attributes;
			    });  
			    var kmlAttributes = getKmlExtraFields ( layer );
			    if( kmlAttributes.length ){
			    	var columns = dojo.map( kmlAttributes , function(item) {
			    		return { field: item, label: item };
			    	});
			    	makegrid( columns );
			    	setPopup( kmlAttributes , title );
			    }
			    else {
			    	var kmlAttributes =	["name", "description"];
			    	var columns = dojo.map( kmlAttributes , function(item) {
			    		return { field: item, label: item };
			    	});
			    	makegrid( columns );
			    	setPopup( kmlAttributes , title );
			    }
			}	    
    	}); 
	}

function setSymbols( lyr ) {
	var ptsym = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 12, 
	   				null, new dojo.Color([255,0,0,0.5]));
	var sptsym = new esri.symbol.SimpleMarkerSymbol().setStyle( esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE).setColor(
	   				new dojo.Color([240,240,2,1]));
	   			
	 var lineSymbol = esri.symbol.SimpleLineSymbol( esri.symbol.SimpleLineSymbol.STYLE_SOLID, 
	   				new dojo.colorFromArray([250,250,250]), 1);
	 var polysym = esri.symbol.SimpleFillSymbol( esri.symbol.SimpleFillSymbol.STYLE_SOLID , 
	   				lineSymbol , new dojo.Color([255,50,50,0.35]) );
	   				
	 var spoly = new esri.symbol.SimpleFillSymbol(esri.symbol.SimpleFillSymbol.STYLE_SOLID,
 					new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_DASHDOT,
 					new dojo.Color([255,0,0]), 2),new dojo.Color([255,255,0,0.25]));
	  		    
	  if( lyr.geometryType ==  "esriGeometryPolygon" ) {
					lyr.setSelectionSymbol( spoly );
	  		    	lyr.setRenderer( new esri.renderer.SimpleRenderer(polysym) );
	  		    }
	  else if ( lyr.geometryType == "esriGeometryPoint" ) {
	  		    	lyr.setRenderer( new esri.renderer.SimpleRenderer(ptsym) );
	  		    	lyr.setSelectionSymbol( sptsym );
	  		    }
	}
	
function setPopup ( attributes , title ) {
   var example = layer.graphics[0].attributes
   var templ = ""
   dojo.forEach( attributes , function  (veld) { 
   	if( Number( example[veld] ) && !isInteger( example[veld])  ) {
   		templ += "<strong>" + veld +"</strong>: ${" + veld + ":NumberFormat(places:3)} <br/>";
   	}
   	else if ( example[veld].substring(0,7) == "http://" ) {
   		templ += "<strong><a href='${" + veld + "}'>" + veld +"</a></strong><br/>"
   	}
   	else {
   		templ +=  "<strong>" + veld +"</strong>: ${" + veld + ":removeUnwanted} <br/>";
   		}		
   });

	template = new esri.InfoTemplate( title , templ  );
	layer.setInfoTemplate( template );
	
   dojo.connect( layer , "onClick", function(evt){
   				if( layer && layer.selectFeatures ){
					var selId = evt.graphic.attributes.id;
					var query = new esri.tasks.Query();
     				query.objectIds = [selId];
     				
     				layer.selectFeatures(query, esri.layers.FeatureLayer.SELECTION_NEW);

					var pt = esri.geometry.webMercatorToGeographic( evt.mapPoint )  
					var xy ="<a href='http://maps.google.be/maps?layer=c&cbll="+pt.y +","+ pt.x +
					 "&cbp=12,0,0,0,0&q=" + pt.y +","+ pt.x +"'>open in google</a>" ;
					map.infoWindow.setContent( evt.graphic.getContent() + xy );
				}
		 });					
	}

//geolocatie
function initFunc(map) {
		map.resize();
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(zoomToLocation, locationError);
			//navigator.geolocation.watchPosition(showLocation, locationError);
		} 
	} 			    //TODO: zoom to layer if no geoloacation: map.setExtent( esri.graphicsExtent( layer.graphics ))  ;

function locationError(error) {
		switch (error.code)  {
			case error.PERMISSION_DENIED:
				alert("Location not provided");
				break;

			case error.POSITION_UNAVAILABLE:
				alert("Current location not available");
				break;

			case error.TIMEOUT:
				alert("Timeout");
				break;

			default:
				alert("unknown error");
				break;
		}
	}

function zoomToLocation(location) {
		var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(location.coords.longitude, location.coords.latitude));
		map.centerAndZoom(pt, 13);
		showLocation( location );
	}

function showLocation(location) {	
		var infotempl  =  new esri.InfoTemplate("Je GPS locatie","breedtegraad: ${y:NumberFormat(places:3)} <br/>"+
		"lengtegraad: ${x:NumberFormat(places:3)} <br/>" +
		"<a href='http://maps.google.be/maps?layer=c&cbll=${y},${x}&cbp=12,0,0,0,0&q=${y},${x}'>open in google</a>");
		 //streetview http://maps.google.be/maps?layer=c&cbll={0},{1}&cbp=12,{2},0,0,0&q={0},{1}
		var attributes = {};
		attributes.x =  location.coords.longitude  ;
		attributes.y =  location.coords.latitude  ;
		
		var sms = new esri.symbol.SimpleMarkerSymbol().setStyle( 
			 esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE).setColor(  new dojo.Color([155,0,255,0.3]));

		map.graphics.clear(); // clear al map graphics
		var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(location.coords.longitude, location.coords.latitude));
		var graphic = new esri.Graphic(new esri.geometry.Point(pt, map.spatialReference), sms , attributes , infotempl );
		map.graphics.add( graphic );
	}

//zoomslider 
function zoomIn() {
        map.setExtent(map.extent.expand(0.5));
      }
      
function zoomOut() {
        map.setExtent(map.extent.expand(2.0));
      }
      
function baseSwitch () {
  	var osm = map.getLayer("OSM");
  	var ortho = map.getLayer("ortho");
  	
  	if ( osm.visible ) {
  		dojo.byId("baseBtn").innerHTML = "Straten";
  		osm.setVisibility( false );
  		ortho.setVisibility( true );
  	}
  	
  	else if ( ortho.visible ) {
  		dojo.byId("baseBtn").innerHTML = "Luchtfoto";
  		ortho.setVisibility( false );
  		osm.setVisibility( true );
  	}
  	
}      

//table
function tabelActive () {
	if( layer && layer.loaded  ) {
			gridtable.refresh();
  			gridtable.renderArray(kmlprops);	
  		    gridtable.resize() ;
  		   }
  	else {
  		dojo.byId( 'attributetable' ).innerHTML = "Data kon niet worden geladen" ;
  	}
	} 

function getKmlExtraFields ( geoLayer ) {
	var result =  [];
	var fields;
	var removeFields= ["id","geometry", "balloonStyleText", "visibility", "shape_area", "shape_length",
	"name", "description", "snippet", "styleUrl"];
	if (  geoLayer.fields ) {
		  fields = dojo.map( geoLayer.fields , function( m ) { return m.name } ) ;
		}
	else {
		  var g = geoLayer.graphics[0];
		  fields = Object.keys( g.attributes );
		}
  	dojo.forEach( fields , function (kmlfield) {
		if(! dojo.some( removeFields ,function (rem){return rem == kmlfield})){
			result.push(kmlfield);
		}
	  });
	return result;
}

//orientation
function orientationChanged() {
		if(map && mapactive) {
			map.reposition();
			map.resize();
		}
		else {
  		 if( gridtable  ) {gridtable.resize()}  
  		}
	}

//util
function isInteger(s){
	var i;
    for (i = 0; i < s.length; i++){   
        // Check that current character is number.
        var c = s.charAt(i);
        if (((c < "0") || (c > "9"))) return false;
    }
    // All characters are numbers.
    return true;
}

function getparams(){
	var urlObj = esri.urlToObject( window.location.href )
	if ( urlObj.query && urlObj.query.kml ) {
		 var datatitle = urlObj.query.kml.split("/")[ urlObj.query.kml.split("/").length - 1].replace(".kml","").replace(".xml","").replace(".kmz","");
		 urlObj.query.datatitle = datatitle;
		}
	else if ( urlObj.query && urlObj.query.odjson ) {
		 var datatitle = urlObj.query.odjson.split("/")[ urlObj.query.odjson.split("/").length - 1].replace(".jsonp","").replace(".json","");
		 urlObj.query.datatitle = datatitle;
		}
	var params = urlObj.query;
	return params
}

//ei7 does not support Object.keys method, by adding this, it does.
Object.keys = Object.keys || (function () {
    var hasOwnProperty = Object.prototype.hasOwnProperty,
        hasDontEnumBug = !{toString:null}.propertyIsEnumerable("toString"),
        DontEnums = [
            'toString',
            'toLocaleString',
            'valueOf',
            'hasOwnProperty',
            'isPrototypeOf',
            'propertyIsEnumerable',
            'constructor'
        ],
        DontEnumsLength = DontEnums.length;
 
    return function (o) {
        if (typeof o != "object" && typeof o != "function" || o === null)
            throw new TypeError("Object.keys called on a non-object");
        var result = [];
        for (var name in o) {
            if (hasOwnProperty.call(o, name))
                result.push(name);
        }
        if (hasDontEnumBug) {
            for (var i = 0; i < DontEnumsLength; i++) {
                if (hasOwnProperty.call(o, DontEnums[i]))
                    result.push(DontEnums[i]);
            }
        }
        return result;
    };
})();

function removeUnwanted (value, key, data) {
  	return value.replace("T00:00:00",'').replace("1899-12-30T",'')
}

dojo.addOnLoad(init);