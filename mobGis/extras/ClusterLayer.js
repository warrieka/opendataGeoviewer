dojo.provide("exp.ClusterLayer");

dojo.declare("exp.ClusterLayer", esri.layers.GraphicsLayer, {
  constructor: function(options) {
    this._clusterTolerance = options.distance || 50;
    this._clusterData = options.data || {};
    this._clusters = [];
    this._clusterLabelColor = options.labelColor || "#000";
    // labelOffset can be zero so handle it differently
    this._clusterLabelOffset = (options.hasOwnProperty("labelOffset")) ? options.labelOffset : -5;
    // graphics that represent a single point
    this._singles = []; // populated when a graphic is clicked
    this._showSingles = options.hasOwnProperty("showSingles") ? options.showSingles : true;
    // symbol for single graphics
    var sms = esri.symbol.SimpleMarkerSymbol;
    this._singleSym = options.singleSymbol || new sms("circle", 6, null, new dojo.Color("#888"));
    this._singleTemplate = options.singleTemplate || new esri.dijit.PopupTemplate({ "title": "", "description": "{*}" });
    this._maxSingles = options.maxSingles || 1000;

    this._webmap = options.hasOwnProperty("webmap") ? options.webmap : false;

    this._sr = options.spatialReference || new esri.SpatialReference({ "wkid": 102100 });
  },
  
  _setMap: function(map, surface) {
    console.log("in setMap, map props: ", map.width, map.extent.getWidth());
    // calculate and set the initial resolution
    this._clusterResolution = map.extent.getWidth() / map.width; // probably a bad default...
    this.clusterGraphics();

    // connect to onZoomEnd so data is re-clustered when zoom level changes
    dojo.connect(map, "onZoomEnd", this, function() {
      // update resolution
      this._clusterResolution = this._map.extent.getWidth() / this._map.width;
      this.clear();
      this._clusters.length = 0;
      this.clusterGraphics();
    });

		// GraphicsLayer will add its own listener here
		var div = this.inherited(arguments);
    return div;
	},
  
  // web worker?
  clusterGraphics: function() {
    // first time through, loop through graphics
    for ( var j = 0, jl = this._clusterData.length; j < jl; j++ ) {
      // see if the current feature should be added to a cluster
      var point = this._clusterData[j];
      var clustered = false;
      var numClusters = this._clusters.length;
      for ( var i = 0; i < this._clusters.length; i++ ) {
        var c = this._clusters[i];
        if ( this.clusterTest(point, c) ) {
          this.clusterAdd(point, c);
          clustered = true;
          break;
        }
      }

      if ( ! clustered ) {
        this.clusterCreate(point);
      }
    }
    this.showClusters();
  },

  clusterTest: function(p, cluster) {
    var distance = (
      Math.sqrt(
        Math.pow((cluster.x - p.x), 2) + Math.pow((cluster.y - p.y), 2)
      ) / this._clusterResolution
    );
    return (distance <= this._clusterTolerance);
  },

  // points passed to clusterAdd should be included 
  // in an existing cluster
  // also give the point an attribute called clusterId 
  // that corresponds to its cluster
  clusterAdd: function(p, cluster) {
    // average in the new point to the cluster geometry
    var count, x, y;
    count = cluster.attributes.clusterCount;
    x = (p.x + (cluster.x * count)) / (count + 1);
    y = (p.y + (cluster.y * count)) / (count + 1);
    cluster.x = x;
    cluster.y = y;

    // build an extent that includes all points in a cluster
    // extents are for debug/testing only...not used by the layer
    if ( p.x < cluster.attributes.extent[0] ) {
      cluster.attributes.extent[0] = p.x;
    } else if ( p.x > cluster.attributes.extent[2] ) {
      cluster.attributes.extent[2] = p.x;
    }
    if ( p.y < cluster.attributes.extent[1] ) {
      cluster.attributes.extent[1] = p.y;
    } else if ( p.y > cluster.attributes.extent[3] ) {
      cluster.attributes.extent[3] = p.y;
    }

    // increment the count
    cluster.attributes.clusterCount++;
    // attributes might not exist
    if ( ! p.hasOwnProperty("attributes") ) {
      p.attributes = {};
    }
    // give the graphic a cluster id
    p.attributes.clusterId = cluster.attributes.clusterId;
  },

  // graphic passed to clusterCreate isn't within the 
  // clustering distance specified for the layer so
  // create a new cluster for it
  clusterCreate: function(p) {
    var clusterId = this._clusters.length + 1;
    // p.attributes might be undefined
    if ( ! p.attributes ) {
      p.attributes = {};
    }
    p.attributes.clusterId = clusterId;
    // create the cluster
    var cluster = { 
      "x": p.x,
      "y": p.y,
      "attributes" : {
        "clusterCount": 1,
        "clusterId": clusterId,
        "extent": [ p.x, p.y, p.x, p.y ]
      }
    };
    this._clusters.push(cluster);
  },

  showClusters: function() {
    for ( var i = 0, il = this._clusters.length; i < il; i++ ) {
      var c = this._clusters[i];
      var point = new esri.geometry.Point(c.x, c.y, this._sr);
      this.add(
        new esri.Graphic(
          point, 
          null, 
          c.attributes
        )
      );
      // don't label cluster with a single point
      if ( c.attributes.clusterCount == 1 ) {
        continue;
      }

      // show number of points in the cluster
      var label = new esri.symbol.TextSymbol(c.attributes.clusterCount)
        .setColor(new dojo.Color(this._clusterLabelColor))
        .setOffset(0, this._clusterLabelOffset);
      this.add(
        new esri.Graphic(
          point,
          label,
          c.attributes
        )
      );
    }
  },

  clearSingles: function(singles) {
    var s = singles || this._singles;
    dojo.forEach(s, function(g) {
      this.remove(g);
    }, this);
    this._singles.length = 0;
  },

  addSingles: function(singles) {
    // add single graphics to the map
    dojo.forEach(singles, function(p) {
      var g = new esri.Graphic(
        new esri.geometry.Point(p.x, p.y, this._sr),
        this._singleSym,
        p.attributes,
        // new esri.InfoTemplate("", "${*}")
        this._singleTemplate
      );
      this._singles.push(g);
      if ( this._showSingles ) {
        this.add(g);
      }
    }, this);
    this._map.infoWindow.setFeatures(this._singles);
    this._map.infoWindow.select(0);
  },

  onClick: function(e) {
    console.log("cluster layer on click");
    // remove any previously showing single features
    this.clearSingles(this._singles);

    // find single graphics that make up the cluster that was clicked
    // would be nice to use filter but performance tanks with large arrays in IE
    var singles = [];
    for ( var i = 0, il = this._clusterData.length; i < il; i++) {
      if ( e.graphic.attributes.clusterId == this._clusterData[i].attributes.clusterId ) {
        singles.push(this._clusterData[i]);
      }
    }
    if ( singles.length > this._maxSingles ) {
      alert("Sorry, that cluster contains more than 1000 graphics. Zoom in for more detail.");
      return;
    } else {
      // with webmaps, prevent the click from bubbling up
      // so that the map doesn't close the popup
      if ( this._webmap ) {
        e.stopPropagation();
      }
      this._map.infoWindow.show(e.graphic.geometry);
      this.addSingles(singles);
    }
  },

  // debug only...never called by the layer
  clusterMeta: function() {
    // print total number of features
    console.log("Total:  ", this._clusterData.length);

    // add up counts and print it
    var count = 0;
    dojo.forEach(this._clusters, function(c) {
      count += c.attributes.clusterCount;
    });
    console.log("In clusters:  ", count);
  }

});

