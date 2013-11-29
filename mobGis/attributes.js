/**
 * @author kay warrie
 * (c) Copyright 2012 kay warrie, All Rights Reserved. 
 */		
var gridtable; 
 
function makegrid ( fields ) {
	require(["dojo/_base/declare", "dgrid/Grid", "dgrid/Keyboard", "dgrid/Selection", 
	 "dgrid/extensions/ColumnResizer",  "dgrid/extensions/ColumnReorder", "dgrid/extensions/ColumnHider", "dojo/domReady!"],
	 function(declare, Grid, Keyboard, Selection, ColumnResizer, ColumnReorder, ColumnHider){

		        // Create a new constructor by mixing in the components
		        var CustomGrid = declare([ Grid, Keyboard, Selection, ColumnResizer,ColumnReorder, ColumnHider ]);
		 
		        // Now, create an instance of our custom grid which
		        // have the features we added!
		        gridtable = new CustomGrid({
		            columns: fields,
		            selectionMode: "single", // for Selection; only select a single row at a time
		            cellNavigation: false // for Keyboard; allow only row-level keyboard navigation
		        }, "attributetable");   

			});
			
} 


/*	grid.on("dgrid-select", function(event){
    // get the rows that were just selected
    var rows = event.rows;
    // ...
    
    // iterate through all currently-selected items
    for(var id in grid.selection){
        // ...
    }	

function selectState(e) {
      // select the feature
      var fl = layer;
      var query = new esri.tasks.Query();
      
      query.objectIds = [parseInt(e.target.innerHTML)];
      
      
      fl.selectFeatures(query, esri.layers.FeatureLayer.SELECTION_NEW, function(result) {
        if ( result.length ) {
        	var w = dijit.byId('view2');
			w.performTransition('view1',1,"fade",null);
        	
          // re-center the map to the selected feature
          window.map.centerAt(result[0].geometry.getExtent().getCenter());
        } else {
          console.log("Feature Layer query returned no features... ", result);
        }
      });
    }
*/