(function(){
  
  /////////////////////////////////////////////////////////////////////// data_cube fields /////////////////////////////////////////////////////////////////////////////////////////////

  var data_cube = {};
  var samples = [];
  var taxa_tree = {};
  var func_tree = {};
  var taxa_lookup = {};
  var func_lookup = {};
  var displayed_taxa = [];
  var displayed_funcs = [];
  var original_contribution_cube = {};
  var displayed_contribution_cube = {};

  /////////////////////////////////////////////////////////////////////// is_leaf /////////////////////////////////////////////////////////////////////////////////////////////

  // Checks whether a node in a tree is a leaf node
  function is_leaf(node){
    if (node.hasOwnProperty('values')){
      for (var i = 0; i < node.values.length; i++){
        if (node.values[i].hasOwnProperty('values')){
          return false;
        }
      }
      return true;
    } else {
      return false;
    }
  }

  /////////////////////////////////////////////////////////////////////// no_cube_calculate_new_contribution /////////////////////////////////////////////////////////////////////////////////////////////

  // Returns the contribution of the given taxon to the given function relative to the total functional abundance in the given sample
  // Uses the original tsv data
  function no_cube_calculate_new_contribution(sample, taxon, func){

    // Get the leaf nodes under the give taxon and func
    var leaf_taxa = [];
    var leaf_funcs = [];

    // Use a BFS to find the leaf otus
    var curr_taxa = [];
    curr_taxa.push(taxa_lookup[taxon]);
    for (; curr_taxa.length > 0;){
      curr_taxon = curr_taxa.shift();
      if (is_leaf(curr_taxon)){
        leaf_taxa.push(curr_taxon.key);
      } else {
        for (var i = 0; i < curr_taxon.values.length; i++){
          curr_taxa.push(curr_taxon.values[i]);
        }
      }
    }

    // Use a BFS to find the leaf kos
    var curr_funcs = [];
    curr_funcs.push(func_lookup[func]);
    for (; curr_funcs.length > 0;){
      curr_func = curr_funcs.shift();
      if (is_leaf(curr_func)){
        leaf_funcs.push(curr_func.key);
      } else {
        for (var i = 0; i < curr_func.values.length; i++){
          curr_funcs.push(curr_func.values[i]);
        }
      }
    }

    // Sum the relative contributions to each leaf ko by each leaf otu
    var total = 0;
    for (var i = 0; i < contribution_data.length; i++){
      var curr_otu = contribution_data[i].Genus;
      var curr_ko = contribution_data[i].SubPathway;
      var curr_sample = contribution_data[i].Sample;
      if (leaf_taxa.indexOf(curr_otu) != -1 && leaf_funcs.indexOf(curr_ko) != -1 && sample == curr_sample){
        var contribution_fraction = 0;
        for (var j = 0; j < func_rel_abundance_data.length; j++){
          if (sample == func_rel_abundance_data[j].Sample){
            contribution_fraction = parseFloat(func_rel_abundance_data[j][curr_ko]);
          }
        }
        total += parseFloat(contribution_data[i].ContributionPercentOfSample) * contribution_fraction;
      }
    }

    return(total);
  }

  /////////////////////////////////////////////////////////////////////// calculate_new_contribution /////////////////////////////////////////////////////////////////////////////////////////////

  // Returns the contribution of the given taxon to the given function relative to the total functional abundance in the given sample
  // Uses the original_contribution_cube
  function calculate_new_contribution(sample, taxon, func){

    // Get the leaf nodes under the give taxon and func
    var leaf_taxa = [];
    var leaf_funcs = [];

    // Use a BFS to find the leaf otus
    var curr_taxa = [];
    curr_taxa.push(taxa_lookup[taxon]);
    for (; curr_taxa.length > 0;){
      curr_taxon = curr_taxa.shift();
      if (is_leaf(curr_taxon)){
        leaf_taxa.push(curr_taxon.key);
      } else {
        for (var i = 0; i < curr_taxon.values.length; i++){
          curr_taxa.push(curr_taxon.values[i]);
        }
      }
    }

    // Use a BFS to find the leaf kos
    var curr_funcs = [];
    curr_funcs.push(func_lookup[func]);
    for (; curr_funcs.length > 0;){
      curr_func = curr_funcs.shift();
      if (is_leaf(curr_func)){
        leaf_funcs.push(curr_func.key);
      } else {
        for (var i = 0; i < curr_func.values.length; i++){
          curr_funcs.push(curr_func.values[i]);
        }
      }
    }

    // Now sum all the contributions across those leaf otus and leaf kos for the given sample
    var total = 0;
    for (var i = 0; i < leaf_taxa.length; i++){
      var leaf_taxon = leaf_taxa[i];
      if (original_contribution_cube[sample].hasOwnProperty(leaf_taxon)){
        for (var j=0; j < leaf_funcs.length; j++){
          var leaf_func = leaf_funcs[j];
          if (i == 0 && j == 0){
            console.log(leaf_taxon);
            console.log(leaf_func);
            console.log(sample);
          }
          if (original_contribution_cube[sample][leaf_taxon].hasOwnProperty(leaf_func)){
            total += original_contribution_cube[sample][leaf_taxon][leaf_func];
          }
        }
      }
    }

    return total;
  }

  /////////////////////////////////////////////////////////////////////// expand_func_displayed_contribution_cube /////////////////////////////////////////////////////////////////////////////////////////////

  // Expand the chosen function in the displayed_contribution_cube to replace the original function entry with its children function entries
  function expand_func_displayed_contribution_cube(func){
    var curr_func = func_lookup[func];

    // Only try to expand if the function has children
    if (!is_leaf(curr_func)){

      // Go through each entry in the cube corresponding to the function
      for (var sample in displayed_contribution_cube){
        for (var taxon in displayed_contribution_cube[sample]){

          // Remove the entry in the cube corresponding to the function
          delete displayed_contribution_cube[sample][taxon][func];

          //  Find the immediate children of the function and add their entries to the cube
          for (var i = 0; i < curr_func.values.length; i++){
            displayed_contribution_cube[sample][taxon][new_func_name] = calculate_new_contribution(sample, taxon, curr_func.values[i].key);
          }
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////// collapse_func_displayed_contribution_cube /////////////////////////////////////////////////////////////////////////////////////////////

  // Collapse the chosen function in the displayed_contribution_cube to replace the entries of the currently displayed descendents of the function with the new function entry
  function collapse_func_displayed_contribution_cube(func){
    var curr_func = func_lookup[func];

    // Only try to collapse if the function has children
    if (!is_leaf(curr_func)){

      // Find all of the function's descendents that are currently displayed using a BFS
      var func_children = [];
      var func_present_children = [];
      for (var i = 0; i < curr_func.values.length; i++){
        func_children.push(curr_func.values[i])
        for (; func_children.length > 0;){
          var curr_child = func_children.shift();

          // If the descendent function we are looking at has children, check whether this descendent function is currently displayed, or if we need to check its children
          if (!is_leaf(curr_child)){
            var name = curr_child.key;

            //  If this descendent function is currently displayed, record that and move on
            if (displayed_funcs.indexOf(name) != -1){
              func_present_children.push(name);

            // Otherwise, add its children to check later
            } else {
              for (var j = 0; j < curr_child.values.length; j++){
                func_children.push(curr_child.values[j]);
              }
            }

          // Otherwise, since we know it has no children, it must be currently displayed
          } else {
            func_present_children.push(curr_child.key);
          }
        }
      }

      // For each descendent function that is currently displayed, remove its entry from the displayed_contribution_cube
      for (var sample in displayed_contribution_cube){
        for (var taxon in displayed_contribution_cube[sample]){

          // Sum the contributions of the displayed descendents to speed up adding the new function's entry to the cube
          var total = 0;
          for (var i = 0; i < func_present_children.length; i++){
            total += displayed_contribution_cube[sample][taxon][func_present_children[i]]
            delete displayed_contribution_cube[sample][taxon][func_present_children[i]];
          }

          displayed_contribution_cube[sample][taxon][func] = total;
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////// expand_taxon_displayed_contribution_cube /////////////////////////////////////////////////////////////////////////////////////////////

  // Expand the chosen taxon in the displayed_contribution_cube to replace the original taxon entry with its children taxon entries
  function expand_taxon_displayed_contribution_cube(taxon){
    var curr_taxon = taxa_lookup[taxon];

    // Only try to expand if the taxon has children
    if (!is_leaf(curr_taxon)){

      // Go through each entry in the cube corresponding to the taxon
      for (var sample in displayed_contribution_cube){

        // Remove the entry in the cube corresponding to the taxon
        delete displayed_contribution_cube[sample][taxon];

        // Find the immediate children of the taxon and add their entries to the cube
        for (var i = 0; i < curr_taxon.values.length; i++){
          displayed_contribution_cube[sample][curr_taxon.values[i].key] = {}

          // For each function currently displayed, add an entry for that function
          for (var j = 0; j < displayed_funcs.length; j++){
            displayed_contribution_cube[sample][new_taxon_name][displayed_funcs[j]] = calculate_new_contribution(sample, new_taxon_name, displayed_funcs[j]);
          }
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////// collapse_taxon_displayed_contribution_cube /////////////////////////////////////////////////////////////////////////////////////////////

  // Collapse the chosen taxon in the displayed_contribution_cube to replace the entries of the currently displayed descendents of the taxon with the new taxon entry

  function collapse_taxon_displayed_contribution_cube(taxon){
    var curr_taxon = taxon_lookup[taxon];

    // Only try to collapse if the taxon has children
    if (!is_leaf(curr_taxon)){

      // Find all of the taxon's descendents that are currently displayed using a BFS
      var taxon_children = [];
      var taxon_present_children = [];
      for (var i = 0; i < curr_taxon.values.length; i++){
        taxon_children.push(curr_taxon.values[i])
        for (; taxon_children.length > 0;){
          var curr_child = taxon_children.shift();

          // If the descendent taxon we are looking at has children, check whether this descendent taxon is currently displayed, or if we need to check its children
          if (!is_leaf(curr_child)){
            var name = curr_child.key;

           //  If this descendent taxon is currently displayed, record that and move on                  
            if (displayed_taxa.indexOf(name) != -1){
              taxon_present_children.push(name);

            // Otherwise, add its children to check later                    
            } else {
              for (var j = 0; j < curr_child.values.length; j++){
                taxon_children.push(curr_child.values[j]);
              }
            }

          // Otherwise, since we know it has no children, it must be currently displayed                  
          } else {
            taxon_present_children.push(curr_child.key);
          }
        }
      }

      // For each descendent taxon that is currently displayed, remove its entry from the displayed_contribution_cube
      for (var sample in displayed_contribution_cube){
        for (var i = 0; i < taxon_present_children.length; i++){
          var child_taxon_name = taxon_present_children[i];

          // Sum the contributions of the displayed descendents to speed up adding the new taxon's entry to the cube
          var contributions = {};
          for (func in displayed_contribution_cube[sample][child_taxon_name]){
            var contribution = displayed_contribution_cube[sample][child_taxon_name][func];
            if (contributions.hasOwnProperty(func)){
              contributions[func] += contribution;
            } else {
              contributions[func] = contribution;
            }
          }
          delete displayed_contribution_cube[sample][child_taxon_name];
        }

        // Add in the new taxon, along with its function contributions
        displayed_contribution_cube[sample][taxon] = {};
        for (var j = 0; j < displayed_funcs.length; j++){
          var func = displayed_funcs[j];
          if (contributions.hasOwnProperty(func)){
            displayed_contribution_cube[sample][taxon][func] = contributions[func];
          }
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////// expand_func_displayed_funcs /////////////////////////////////////////////////////////////////////////////////////////////

  // Expand the chosen function in the displayed_funcs to replace the original function entry with its children function entries        
  function expand_func_displayed_funcs(func){
    var curr_func = func_lookup[func];

    // Only try to expand if the function has children
    if (!is_leaf(curr_func)){

      // Remove the function being expanded
      displayed_funcs.splice(displayed_funcs.indexOf(curr_func.key), 1);

      // For each child of the expanded function, add that child to the displayed_funcs
      for (var i = 0; i < curr_func.values.length; i++){
        displayed_funcs.push(curr_func.values[i].key)
      }
    }
  }

  /////////////////////////////////////////////////////////////////////// collapse_func_displayed_funcs /////////////////////////////////////////////////////////////////////////////////////////////

  // Collapse the chosen function in the displayed_funcs to replace the descendent functions with the new function
  function collapse_func_displayed_funcs(func){
    var curr_func = func_lookup[func];

    // Only try to collapse if the function has children
    if (!is_leaf(curr_func)){

      // Use a BFS to find descendents
      var func_children = [];
      for (var i = 0; i < curr_func.values.length; i++){
        func_children.push(curr_func.values[i])
        for (; func_children.length > 0;){
          var curr_child = func_children.shift();

          // If the descendent has its own children, check whether it is displayed 
          if (!is_leaf(curr_child)){
            name = curr_child.key;

            // If the descendent is displayed, remove it from the list
            if (displayed_funcs.indexOf(name) != -1){
              displayed_funcs.splice(displayed_funcs.indexOf(name), 1);

            // Otherwise remember its children to check later
            } else {
              for (var j = 0; j < curr_child.values.length; j++){
                func_children.push(curr_child.values[j]);
              }
            }

          // Otherwise, it must be displayed, so remove it
          } else {
            displayed_funcs.splice(displayed_funcs.indexOf(curr_child.key), 1);
          }
        }
      }
      displayed_funcs.push(curr_func.key);
    }
  }

  /////////////////////////////////////////////////////////////////////// expand_taxon_displayed_taxa /////////////////////////////////////////////////////////////////////////////////////////////

  // Expand the chosen taxon in the displayed_taxa to replace the original taxon entry with its children taxa entries                
  function expand_taxon_displayed_taxa(taxon){
    var curr_taxon = taxa_lookup[taxon];

    // Only try to expand the taxon if it has children
    if (!is_leaf(curr_taxon)){

      // Remove the taxon from the displayed_taxa
      displayed_taxa.splice(displayed_taxa.indexOf(curr_taxon.key), 1);

      // Add each child taxon to the displayed_taxa
      for (var i = 0; i < curr_taxon.values.length; i++){
        displayed_taxa.push(curr_taxon.values[i].key);
      }
    }
  }

  /////////////////////////////////////////////////////////////////////// collapse_taxon_displayed_taxa /////////////////////////////////////////////////////////////////////////////////////////////

  // Collapse the chosen taxon in the displayed_taxa to replace the descendent taxa with the new taxon
  function collapse_taxon_displayed_taxa(taxon){
    var curr_taxon = taxa_lookup[taxon];

    // Only try to collapse if the taxon has children
    if (!is_leaf(curr_taxon)){

      // Use a BFS to find descendents
      var taxon_children = [];
      for (var i = 0; i < curr_taxon.values.length; i++){
        taxon_children.push(curr_taxon.values[i])
        for (; taxon_children.length > 0;){
          var curr_child = taxon_children.shift();

          // If the descendent has its own children, check whether it is displayed
          if (!is_leaf(curr_child)){
            name = curr_child.key;

            // If the descendent is displayed, remove it from the list
            if (displayed_taxa.indexOf(name) != -1){
              displayed_taxa.splice(displayed_taxa.indexOf(name), 1);

            // Otherwise, remember its children to check later
            } else {
              for (var j = 0; j < curr_child.values.length; j++){
                taxon_children.push(curr_child.values[j]);
              }
            }

          // Otherwise, it must be displayed, so remove it
          } else {
            displayed_taxa.splice(displayed_taxa.indexOf(curr_child.key), 1);
          }
        }
      }
      displayed_taxa.push(curr_taxon.key);
    }
  }

  /////////////////////////////////////////////////////////////////////// initialize_cube /////////////////////////////////////////////////////////////////////////////////////////////

  data_cube.initialize_cube = function(contribution_data, taxa_tree_data, func_tree_data, func_rel_abundance_data){

    /////////////////////////////////////////////////////////////////////// samples /////////////////////////////////////////////////////////////////////////////////////////////

    // Create array of sample names from contributions file
    for (var i = 0; i < contribution_data.length; i++){
      var sample = contribution_data[i].Sample;
      if (samples.indexOf(sample) == -1){
        samples.push(sample);
      }
    }

    /////////////////////////////////////////////////////////////////////// taxa_tree /////////////////////////////////////////////////////////////////////////////////////////////

    // Read the taxa tree
    taxa_tree = d3.nest()
      .key(function(d) { return d.Kingdom; })
      .key(function(d) { return d.Phylum; })
      .key(function(d) { return d.Class; })
      .key(function(d) { return d.Order; })
      .key(function(d) { return d.Family; })
      .key(function(d) { return d.Genus; })
      //.key(function(d) { return d.Species; })
      //.key(function(d) { return d.OTU_ID})
      .entries(taxa_tree_data);

    /////////////////////////////////////////////////////////////////////// func_tree /////////////////////////////////////////////////////////////////////////////////////////////

    // Read the func tree
    func_tree = d3.nest()
      .key(function(d) { return d.Category; })
      .key(function(d) { return d.SuperPathway; })
      .key(function(d) { return d.SubPathway; })
      //.key(function(d) { return d.KO; })
      .entries(func_tree_data);

    /////////////////////////////////////////////////////////////////////// taxa_lookup /////////////////////////////////////////////////////////////////////////////////////////////

    // Create a lookup table to get the node in the taxa tree from the name
    // Accessed by taxa_lookup[TAXON_NAME], returns the object in the tree with key=TAXON_NAME, values=children objects, unless it is a leaf, in which case OTU_ID=TAXON_NAME
    curr_taxa = [];

    // Use a BFS to add all taxa
    for (var i = 0; i < taxa_tree.length; i++){
      curr_taxa.push(taxa_tree[i]);
    }
    for (; curr_taxa.length > 0;){
      curr_taxon = curr_taxa.shift();
      taxa_lookup[curr_taxon.key] = curr_taxon;
      if (!is_leaf(curr_taxon)){
        for (var i = 0; i < curr_taxon.values.length; i++){
          curr_taxa.push(curr_taxon.values[i]);
        }
      }
    }

    /////////////////////////////////////////////////////////////////////// func_lookup /////////////////////////////////////////////////////////////////////////////////////////////

    // Create lookup table to get the node in the func tree from the name
    // Accessed by func_lookup[FUNC_NAME], returns the object in the tree with key=FUNC_NAME, values=children objects, unless it is a leaf, in which case KO=FUNC_NAME
    curr_funcs = [];

    // Use a BFS to add all taxa
    for (var i = 0; i < func_tree.length; i++){
      curr_funcs.push(func_tree[i]);
    }
    for (; curr_funcs.length > 0;){
      curr_func = curr_funcs.shift();
      func_lookup[curr_func.key] = curr_func;
      if (!is_leaf(curr_func)){
        for (var i = 0; i < curr_func.values.length; i++){
          curr_funcs.push(curr_func.values[i]);
        }
      }
    }

    /////////////////////////////////////////////////////////////////////// original_contribution_cube /////////////////////////////////////////////////////////////////////////////////////////////

    // For each row in the original TSV, make an entry in the original_contribution_cube
    // Accessed by original_contribution_cube[sample][taxon][func], returns the contribution of the given taxon to the given func relative to the total functional abundance in the given sample
    contribution_data.forEach(function(d) {
      var ko = d.SubPathway;
      var otu = d.Genus;
      var sample = d.Sample;
      var contribution = parseFloat(d.ContributionPercentOfSample);
      var contribution_fraction = 0;
      for (var i = 0; i < func_rel_abundance_data.length; i++){
        if (sample == func_rel_abundance_data[i].Sample){
          contribution_fraction = parseFloat(func_rel_abundance_data[i][ko]);
        }
      }
      contribution *= contribution_fraction

      // If there's already an entry for the sample, move on to check for the otu entry, otherwise add an entry for the sample
      if (sample in original_contribution_cube){

        // If there's already an entry for the otu in this sample, move on to add the ko contribution data, otherwise add an entry for the otu
        if (otu in original_contribution_cube[sample]){
          original_contribution_cube[sample][otu][ko] = contribution;
        } else {
          original_contribution_cube[sample][otu] = {};
          original_contribution_cube[sample][otu][ko] = contribution;
        }
      } else {
        original_contribution_cube[sample] = {};
        original_contribution_cube[sample][otu] = {};
        original_contribution_cube[sample][otu][ko] = contribution;
      };
    });

    /////////////////////////////////////////////////////////////////////// displayed_contribution_cube /////////////////////////////////////////////////////////////////////////////////////////////

    // Create a cube of the currently displayed contribution data
    for (var i = 0; i < samples.length; i++){
      var sample = samples[i];
      displayed_contribution_cube[sample] = {};
      for (var j = 0; j < taxa_tree.length; j++){
        var taxon = taxa_tree[j].key;
        displayed_contribution_cube[sample][taxon] = {};
        for (var k = 0; k < func_tree.length; k++){
          var func = func_tree[k].key;
          displayed_contribution_cube[sample][taxon][func] = calculate_new_contribution(sample, taxon, func);
        }
      }
    }

    /////////////////////////////////////////////////////////////////////// displayed_taxa /////////////////////////////////////////////////////////////////////////////////////////////

    // Create array of currently displayed taxa, start with highest level
    for (var i = 0; i < taxa_tree.length; i++){
      displayed_taxa.push(taxa_tree[i].key);
    }

    /////////////////////////////////////////////////////////////////////// displayed_funcs /////////////////////////////////////////////////////////////////////////////////////////////        

    // Create array of currently displayed functions, start with the highest level
    for (var i = 0; i < func_tree.length; i++){
      displayed_funcs.push(func_tree[i].key);
    }
  }


  /////////////////////////////////////////////////////////////////////// get_contribution /////////////////////////////////////////////////////////////////////////////////////////////

  // Returns the contribution of a taxon to a function in a sample
  data_cube.get_contribution = function(sample, taxon, func){
    return displayed_contribution_cube[sample][taxon][func];
    //return no_cube_calculate_new_contribution(sample, taxon, func);
  }

  this.data_cube = data_cube;
})();