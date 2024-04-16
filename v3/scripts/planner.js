// CONSTANTS
var SEASON_DAYS = 28;
var YEAR_DAYS = SEASON_DAYS * 4;
var VERSION = "3.3";
var DATA_VERSION = "3";
var ACCEPTED_VERSIONS = ["3", "2"];


// Save/load helper functions
function SAVE_JSON(key, data){
	var json_data = JSON.stringify(data);
	localStorage.setItem(key + "_v" + DATA_VERSION, json_data);
}

function LOAD_JSON(key, raw_json){
	var json_data = localStorage.getItem(key + "_v" + DATA_VERSION);
	if (!json_data) return;
	if (raw_json) return json_data;
	return JSON.parse(json_data);
}

// Misc helper functions
function round(num, decimals){
	decimals = Math.pow(10, decimals || 0);
	return Math.round(num * decimals) / decimals;
}


// Angular app
angular.module("planner_app", ["checklist-model"])
	.controller("planner_controller", planner_controller);
	
function planner_controller($scope){
	
	/********************************
		PLANNER VARIABLES
	********************************/
	var self = this; window.planner = self;
	
	// Core data & objects
	self.config = {};
	self.loaded = false;
	self.sidebar;
	self.player;
	self.planner_modal;
	self.players;
	self.current_player;
	
	// Static planner data
	self.dayNums = new Array(YEAR_DAYS);	// Array of days in a year (only used by one ng-repeat)
	self.seasons = [];					// Array of seasons
	self.weathers = [];					// Array of weather conditions
	self.SEASON_DAYS = SEASON_DAYS;		// Exposing SEASON_DAYS constant to app scope
	self.crops_list = []; 				// [id, id, ...]
	self.crops = {}; 					// {id: {data}}	
	self.fertilizer = {}; 				// [fertilizer, fertilizer, ...]
	self.events = {};					// Birthdays & festivals
	self.events_list = []
	self.fish_list = [];
	self.fishes = {}				// [{data}, {data}, ...]
	
	// State objects & variables
	self.years = {};
	
	self.cdate;							// Current date to add plan to
	self.cday;							// Current day to add plan to
	self.cseason;						// Current season
	self.cmode = "farm";				// Current farm mode (farm / greenhouse)
	self.cmodeName = "Farm";
	self.cyear;							// Current year
	
	self.newplan;
	self.editplan;
	
	self.newPlayer;

	// Core planner functions
	self.update = update;
	self.add_plan = add_plan;
	self.add_plan_key = add_plan_key;
	self.edit_plan = edit_plan;
	self.change_player = change_player;
	self.delete_player = delete_player;
	self.add_player = add_player;
	self.open_add_player = open_add_player;
	self.remove_plan = remove_plan;
	self.clear_season = clear_season;
	self.clear_year = clear_year;
	self.clear_all = clear_all;
	self.open_plans = open_plans;
	
	self.inc_year = inc_year;			// Increment/decrement current year
	self.inc_season = inc_season;		// Increment/decrement current season
	self.set_season = set_season;		// Set current season
	self.cfarm = cfarm;					// Get current farm
	self.in_greenhouse = in_greenhouse; // Check if current farm mode == greenhouse
	self.toggle_mode = toggle_mode;		// Toggle current farm mode (farm / greenhouse)
	self.set_mode = set_mode;			// Set current farm mode (farm / greenhouse)
	
	self.get_season = get_season;		// Get season object by id
	self.get_date = get_date;			// Get formatted date string
	self.ci_set_sort = ci_set_sort;		// Set key to sort crop info by
	self.fi_set_sort = fi_set_sort; // Set key to sort fish info by
	self.planner_valid_crops = planner_valid_crops;
	self.save_data = save_data;

	self.refresh_alert = false;
	self.paddy_alert = false;
	
	// Crop info search/filter settings
	self.cinfo_settings = {
		season: "spring",
		seasons: ["spring"],
		season_options: [],
		fish_season_options: [],
		fish_seasons: ["spring"],
		weather_options: [],
		weathers: ["sunny", "crab_pot"],
		weather: "sunny",
		sort: "name",
		fish_search: "",
		search: "",
		regrows: false,
		order: false,
		use_fbp: false,
		fish_sort: "name",
		fish_order: false
	};
	
	
	/********************************
		PLANNER INITIALIZATION
	********************************/
	function init(){
		// Initialize planner variables
		self.sidebar = new Sidebar;
		self.players = [];
		var loaded_players = LOAD_JSON("players", true) ? LOAD_JSON("players") : [];
		self.player = new Player;
		self.planner_modal  = $("#crop_planner");
		self.add_player_modal = $("#add_player")

		// add player to players list
		if(self.player && loaded_players.length == 0) {
			if(!self.player.id) {
				self.player.id = "player-0";
			}

			self.players.push(self.player);
			self.player.save();
		} else if (!self.player.id) {
			self.player.id = "player-" + loaded_players.length;
			self.players.push(self.player);
			self.player.save();
		} else {
			// create new player object for all players
			loaded_players.forEach(function(player) {
				let player_data = new Player(player);
				self.players.push(player_data);
			});
		}

		self.current_player = self.player.id;
		
		for (var i = 0; i < self.dayNums.length; i++)
		{
			self.dayNums[i] = i + 1;
		}

		self.seasons = [new Season(0), new Season(1), new Season(2), new Season(3)];
		self.weathers = [new Weather(0), new Weather(1), new Weather(2)];
		self.cseason = self.seasons[0];
		self.cinfo_settings.season_options = [self.seasons[0], self.seasons[1], self.seasons[2]];
		self.cinfo_settings.fish_season_options = [self.seasons[0], self.seasons[1], self.seasons[2], self.seasons[3]];
		self.cinfo_settings.weather_options = [self.weathers[0], self.weathers[1], self.weathers[2]];
		
		// Enable bootstrap tooltips
		$("body").tooltip({selector: "[data-toggle=tooltip]", trigger: "hover", container: "body"});
		
		// Keydown events
		$(document).keydown(function(e){
			if (planner_event_handler(e)) return;
			if (self.sidebar.keydown(e)) return;
		});

		// Enable collapsible panel buttons
		var coll = document.getElementsByClassName("collapsible");
		var i;

		for (i = 0; i < coll.length; i++) {
			coll[i].addEventListener("click", function () {
				this.classList.toggle("active");
				var content = this.nextElementSibling;
				if (content.style.display === "block") {
					content.style.display = "none";
				} else {
					content.style.display = "block";
				}
			});
		} 
		
		// On modal close: save plans and update
		self.planner_modal.on("hide.bs.modal", function(){
			// Only if currently editing
			if (self.editplan){
				self.editplan = null;
				self.update(self.cyear);
				$scope.$apply();
			}
		});
		
		// Development mode
		// has issues in Firefox, works fine in Chrome
		if (window.location.hash == "#dev"){
			console.log("Development mode enabled.");
			
			// Update CSS every 400 ms
			var stylesheet = $("link[href='style.css']");
			var stylesheet_url = stylesheet.attr("href");
			setInterval(function(){
				var time = Date.now();
				stylesheet.attr("href", stylesheet_url + "?t=" + time);
			}, 400);
		}
		
		// Load planner config data
		$.ajax({
			url: "config.json",
			dataType: "json",
			success: function(config){
				self.config = config;
				
				// Process fish data
				$.each(self.config.fishes, function(i, fish){
					fish = new Fish(fish);
					self.fish_list.push(fish);
					self.fishes[fish.id] = fish;
				});

				// Process crop data
				$.each(self.config.crops, function(i, crop){
					crop = new Crop(crop);
					self.crops_list.push(crop);
					self.crops[crop.id] = crop;
				});
				
				// Process fertilizer data
				$.each(self.config.fertilizer, function(i, fertilizer){
					fertilizer = new Fertilizer(fertilizer);
					self.config.fertilizer[i] = fertilizer;
					self.fertilizer[fertilizer.id] = fertilizer;
				});
				
				// Process events data
				var s_index = 0;
				$.each(self.config.events, function(season_name, season){
					$.each(season, function(ii, c_event){
						c_event.season = s_index;
						c_event = new CalendarEvent(c_event);
						self.events[c_event.date] = c_event;		
						self.events_list.push(c_event);
					});
					
					s_index++;
				});
				
				// Create newplan template
				self.newplan = new Plan;
				self.newPlayer = new Player(null, true)
				
				// Load saved plans from browser storage
				var plan_count = load_data();
				
				// Create first year if it doesn't exist
				if (Object.keys(self.years).length == 0) {
					// create years for each player
					self.players.forEach(function(player) {
						self.years[player.id] = [new Year(0)];
					});
				} else {
					Object.keys(self.years).forEach(function(playerId) {
						if(self.years[playerId].length == 0) {
							self.years[playerId] = [new Year(0)];
						}
					});
				}
				
				// Set year of current player
				self.cyear = self.years[self.player.id][0];
				
				// Debug info
				console.log("Loaded " + self.crops_list.length + " crops.");
				console.log("Loaded " + plan_count + " plans into " + self.years[self.player.id].length + " year(s).");
				
				// Update plans
				update(self.years[self.player.id][0].data.farm, true); // Update farm
				update(self.years[self.player.id][0].data.greenhouse, true); // Update greenhouse
				update(self.years[self.player.id][0].data.ginger_island, true); // Update ginger island
				
				self.loaded = true;
				$scope.$apply();
			},
			error: function(xhr, status, error){
				if (!xhr.responseText) return;
				alert("An error occurred in loading planner data. Check the browser console.");
				console.log("Error: ", status);
				console.log("Reason: ", error);
			}
		});
	}
	
	/********************************
		WATCH INITIALIZATION
	********************************/

	// watch the change in new plan crop
	// adjust the price according to default price
	$scope.$watch("self.newplan", function(newPlan, oldPlan){
		if(!oldPlan || !newPlan) return;
		if(oldPlan.crop_id == newPlan.crop_id && oldPlan.fertilizer.id == newPlan.fertilizer.id) return;
		if(oldPlan.crop.id != newPlan.crop_id) {
			var crop = self.crops[newPlan.crop_id];
			if (!crop) return;
			self.newplan.buy = crop.buy;
			self.paddy_alert = crop.paddy_crop;
		}

		if(oldPlan.fertilizer.id != newPlan.fertilizer.id) {
			var fertilizer = self.fertilizer[newPlan.fertilizer.id];
			if (!fertilizer) return;
			self.newplan.fertilizerBuy = fertilizer.buy;
		}
	}, true);

	$scope.$watch("self.editplan", function(newPlan, oldPlan){
		if(!oldPlan || !newPlan) return;
		if(oldPlan.fertilizer.id != newPlan.fertilizer.id) {
			var fertilizer = self.fertilizer[newPlan.fertilizer.id];
			if (!fertilizer) return;
			self.editplan.fertilizerBuy = fertilizer.buy;
		}
	}, true);

	$scope.$watch("self.player", function(newPlayer, oldPlayer){
		if(!oldPlayer || !newPlayer) return;
		if(newPlayer.profit_margin != newPlayer.current_profit_margin) {
			self.refresh_alert = true;
		} else {
			self.refresh_alert = false;
		}

		if(newPlayer.name != oldPlayer.name) {
			self.players.forEach(function(player) {
				if(player.id == newPlayer.id) {
					player.name = newPlayer.name;
				}
			});

			var json_players = [];

			self.players.forEach(function(player) {
				var player_data = {
					agriculturist: player.agriculturist,
					profit_margin: player.profit_margin,
					id: player.id,
					level: player.level,
					name: player.name,
					settings: player.settings,
					tiller: player.tiller
				}

				json_players.push(player_data);
			});
		
			newPlayer.save();
		}
	}, true);

	$scope.$watch("self.current_player", function(newPlayer, oldPlayer){
		if(!oldPlayer || !newPlayer || oldPlayer == newPlayer) return;
		var new_player = self.players.find(function(player) {
			return player.id == newPlayer;
		});
		self.change_player(new_player);
	}, true);
	
	/********************************
		CORE PLANNER FUNCTIONS
	********************************/
	// Planner general event handler
	function planner_event_handler(e){
		// Not focused on anything
		if ($(document.activeElement).is("input") || $(document.activeElement).is("textarea")) return;
		
		// Sidebar must be closed
		if (self.sidebar.is_open()) return;
		
		// Planner modal must be closed
		if (self.planner_modal.hasClass("in")) return;
		
		var event_handled = true;
		if (e.which == 39){
			// Right arrow
			self.inc_season(1);
		} else if (e.which == 37){
			// Left arrow
			self.inc_season(-1);
		} else if (e.which == 27){
			// ESC
			self.sidebar.open("cropinfo");
		} else if (e.which == 192){
			// Tilde
			self.toggle_mode();
		} else {
			event_handled = false;
		}
		
		if (event_handled){
			e.preventDefault();
			$scope.$apply();
			return true;
		}
	}
	
	// Save plan data to browser storage
	function save_data(){
		// Save plan data
		var old_plans = LOAD_JSON("plans", true) ? LOAD_JSON("plans") : {};
		$.each(self.years, function(playerId, year){

			$.each(year, function(i, year) {
				var year_data = year.get_data();

				if(!old_plans[playerId]) {
					old_plans[playerId] = [];
				}

				old_plans[playerId][i] = year_data;
			});
		});

		// filter out plans of non-existent players
		var new_plans = {};

		self.players.forEach(function(player) {
			new_plans[player.id] = old_plans[player.id];
		});

		SAVE_JSON("plans", new_plans);
	}
	
	// Load plan data from browser storage
	function load_data(){
		// Load plan data
		var plan_data = LOAD_JSON("plans");
		var players_data = LOAD_JSON("players") ? LOAD_JSON("players") : [];
		var plan_count = 0;
		if (!plan_data) return 0;
		
		// get player plans
		$.each(players_data, function(i, player) {
			var playerId = player.id;

			var player_plans = plan_data[playerId] ? plan_data[playerId] : [];
			var player_years = [];

			$.each(player_plans, function(i, year_data){
				var new_year = new Year(i);
				plan_count += new_year.set_data(year_data);
				player_years.push(new_year);
			});

			self.years[playerId] = player_years;
		});

		// if from old version
		if(Array.isArray(plan_data)) {
			$.each(plan_data, function(i, year_data){
				var new_year = new Year(i);
				plan_count += new_year.set_data(year_data);
				self.years[self.player.id].push(new_year);
			});
		}

		// Set current player year
		self.cyear = self.years[self.player.id][0];

		// Load days data
		var days_data = LOAD_JSON("days");
		if (days_data) {
			self.days = days_data;
		}
		
		return plan_count;
	}
	
	// Update planner info of current farm/year
	function update(farm, full_update){
		// Received year, expected farm
		if (farm instanceof Year) farm = farm.farm();
		
		// If farm is null, get first farm/year
		farm = farm || self.years[self.player.id][0].farm();
		
		// Update all years after this one VS just this year
		full_update = full_update || (farm.greenhouse && farm.has_regrowing_crops());
		
		// Reset harvests
		farm.harvests = [];
		
		// Reset financial totals
		farm.totals = {};
		farm.totals.day = {};
		farm.totals.season = [new Finance, new Finance, new Finance, new Finance];
		farm.totals.year = new Finance;
		
		// Rebuild data
		$.each(farm.plans, function(date, plans){
			date = parseInt(date);
			
			$.each(plans, function(i, plan){
				var crop = plan.crop;
				var first_harvest = date + plan.get_grow_time();
				var planting_cost = plan.get_cost();
				var season = self.seasons[Math.floor((plan.date-1)/SEASON_DAYS)];
				var crop_end = crop.end;
				
				if (farm.greenhouse || farm.ginger_island){
					crop_end = YEAR_DAYS;
				}
				
				// Update daily costs for planting
				if (!farm.totals.day[date]) farm.totals.day[date] = new Finance;
				var d_plant = farm.totals.day[date];
				d_plant.profit.min -= planting_cost;
				d_plant.profit.max -= planting_cost;
				d_plant.cost -= planting_cost;
				
				// Update seasonal costs for planting
				var s_plant_total = farm.totals.season[season.index];
				s_plant_total.profit.min -= planting_cost;
				s_plant_total.profit.max -= planting_cost;
				s_plant_total.cost -= planting_cost;
				
				// Update seasonal number of plantings
				s_plant_total.plantings += plan.amount;
				
				// If first harvest of crop occurs after its
				// growth season(s), continue $.each
				if (first_harvest > crop_end) return;
				
				// Initial harvest
				var harvests = [];
				harvests.push(new Harvest(plan, first_harvest));
				
				// Regrowth harvests
				if (crop.regrow){
					var regrowths = Math.floor((crop_end - first_harvest) / crop.regrow);
					for (var i = 1; i <= regrowths; i++){
						var regrow_date = first_harvest + (i * crop.regrow);
						if (regrow_date > crop_end) break;
						harvests.push(new Harvest(plan, regrow_date, true));
					}
				}
				
				// Assign harvests to plan object
				plan.harvests = harvests;

				// update costs for harvest based on regrowth
				plan.harvests.forEach(function(harvest){
					if(harvest.is_regrowth) {
						harvest.update_cost();
					}
				});
				
				// Add up all harvests
				for (var i = 0; i < harvests.length; i++){
					var harvest = harvests[i];
					
					// Update harvests
					if (!farm.harvests[harvest.date]) farm.harvests[harvest.date] = [];
					farm.harvests[harvest.date].push(harvest);
					
					// Update daily revenues from harvests
					if (!farm.totals.day[harvest.date]) farm.totals.day[harvest.date] = new Finance;
					var d_harvest = farm.totals.day[harvest.date];
					d_harvest.profit.min += harvest.revenue.min;
					d_harvest.profit.max += harvest.revenue.max;
					d_harvest.revenue.min += harvest.revenue.min;
					d_harvest.revenue.max += harvest.revenue.max;
					
					// Update seasonal revenues from harvests
					var h_season = Math.floor((harvest.date - 1) / SEASON_DAYS);
					var s_harvest_total = farm.totals.season[h_season];
					s_harvest_total.profit.min += harvest.revenue.min;
					s_harvest_total.profit.max += harvest.revenue.max;
					s_harvest_total.revenue.min += harvest.revenue.min;
					s_harvest_total.revenue.max += harvest.revenue.max;
					
					// Update seasonal number of harvests
					s_harvest_total.harvests.min += harvest.yield.min;
					s_harvest_total.harvests.max += harvest.yield.max;
				}
			});
		});
		
		// Add up annual total
		for (var i = 0; i < farm.totals.seasons; i++){
			var season = farm.totals.seasons[i];
			var y_total = farm.totals.year;
			y_total.profit.min += season.profit.min
			y_total.profit.max += season.profit.max
		}
		
		// Update next year
		if (full_update){
			var next_year = farm.year.next();
			if (!next_year) return;
			update(next_year, true);
		}
	}
	
	// Add self.newplan to plans list
	function add_plan(date, auto_replant){
		if (!validate_plan_amount()) return;
		self.cyear.add_plan(self.newplan, date, auto_replant);
		self.newplan = new Plan;
	}
	
	// Add plan to plans list on enter keypress
	function add_plan_key(date, e){
		if (e.which != 13) return;
		if (!validate_plan_amount()) return;
		add_plan(date);
	}
	
	// Validate newplan amount
	function validate_plan_amount(){
		// Remove all whitespace
		var amount = (self.newplan.amount + "") || "";
		amount = amount.replace(/\s/g, "");
		
		// Is empty string
		if (!amount){
			self.newplan.amount = 1;
			return;
		}
		
		// Check if input is in gold
		if (amount.toLowerCase().endsWith("g")){
			var match = amount.match(/^([0-9]+)g$/i)
			if (!match) return;
			
			var gold = parseInt(match[1] || 0);
			var crop = self.crops[self.newplan.crop_id];
			if (!crop) return;
			amount = Math.floor(gold / crop.buy);
			amount = amount || 1;
			self.newplan.amount = amount;
			return;
		}
		
		// Invalid non-integer amount
		if (!amount.match(/^[0-9]+$/)) return;
		
		// Parse normal integer input
		amount = parseInt(amount || 0);
		if (amount <= 0) return;
		
		return true;
	}
	
	// Edit plan
	function edit_plan(plan, save){
		if (save){
			// Save edit

			// if the adjusted price is removed, the cost will be set to the default price
			if(!plan.buy) {
				plan.buy = self.crops[plan.crop.id].buy;
			}

			if(!plan.fertilizerBuy) {
				plan.fertilizerBuy = self.fertilizer[plan.fertilizer.id].buy;
			}
			self.editplan = null;
			save_data();
			update(self.cyear);
			return;
		} else if (self.editplan){
			// Other edit already open
			save_data();
			update(self.cyear);
		}

		self.editplan = plan;
	}
	
	// Remove plan from plans list of current farm/year
	function remove_plan(date, index){
		self.editplan = null;
		self.cyear.remove_plan(date, index);
	}

	function change_player(player) {
		self.player = player;
		self.cmode = "farm";
		self.cmodeName = "Farm";
		self.cseason = self.seasons[0];
		self.newplan = new Plan;
		self.editplan = null;
		self.refresh_alert = false;
		self.paddy_alert = false;

		console.log("Changing player to: ", player.id)
		console.log("Years: ", self.years[player.id])

		self.cyear = self.years[self.player.id][0];
		update(self.years[self.player.id][0].data.farm, true); // Update farm
		update(self.years[self.player.id][0].data.greenhouse, true); // Update greenhouse
		update(self.years[self.player.id][0].data.ginger_island, true); // Update ginger island
	}

	function delete_player() {
		self.players = self.players.filter(function(player) {
			return player.id != self.player.id;
		});

		delete self.years[self.player.id];

		save_data();

		if(self.players.length > 0) {
			self.player = self.players[0];
			self.current_player = self.player.id;
			self.cyear = self.years[self.player.id][0];
			update(self.years[self.player.id][0].data.farm, true); // Update farm
			update(self.years[self.player.id][0].data.greenhouse, true); // Update greenhouse
			update(self.years[self.player.id][0].data.ginger_island, true); // Update ginger island
		} else {
			self.player = new Player;
			self.current_player = self.player.id;
			self.years[self.player.id] = [new Year(0)];
			self.cyear = self.years[self.player.id][0];
			self.newplan = new Plan;
			self.editplan = null;
			update(self.years[self.player.id][0].data.farm, true); // Update farm
			update(self.years[self.player.id][0].data.greenhouse, true); // Update greenhouse
			update(self.years[self.player.id][0].data.ginger_island, true); // Update ginger island
		}

		self.player.save();
	}

	function add_player() {
		self.players.push(self.newPlayer);
		self.player = self.newPlayer;
		self.current_player = self.player.id;
		self.cmode = "farm";
		self.cmodeName = "Farm";
		self.cseason = self.seasons[0];
		self.newplan = new Plan;
		self.editplan = null;
		self.add_player_modal.modal("hide");
		self.refresh_alert = false;
		self.paddy_alert = false;
		save_data();

		self.player.save();
		self.newPlayer = new Player(null, true);

		// add player to years
		self.years[self.player.id] = [new Year(0)];
		self.cyear = self.years[self.player.id][0];
	}
	
	// Remove plans from current farm/season
	function clear_season(season){
		var full_update = self.cfarm().has_regrowing_crops(season);
		for (var date = season.start; date <= season.end; date++){
			self.cfarm().plans[date] = [];
		}
		save_data();
		update(self.cyear, full_update);
	}
	
	// Remove plans from current farm/year
	function clear_year(year){
		var farm = year.farm();
		var full_update = farm.has_regrowing_crops();
		$.each(farm.plans, function(date, plans){
			farm.plans[date] = [];
		});
		year.generate_days();
		save_data();
		update(year, full_update);
	}
	
	// Remove all plans
	function clear_all(){
		if (!confirm("Permanently clear all plans?")) return;
		self.years = [new Year(0)];
		self.cyear = self.years[0];
		save_data();
		update(null, true);
	}
	
	// Open crop planner modal
	function open_plans(date){
		self.planner_modal.modal();
		self.cdate = date;
		self.cday = self.cyear.data.days[date];
	}

	// Open new player modal
	function open_add_player() {
		self.add_player_modal.modal();
	}
	
	////////////////////////////////
	
	// Increment/decrement current year; creates new year if necessary
	function inc_year(direction){
		direction = direction > 0 ? true : false;
		
		if (direction){
			// Next year
			self.cyear = self.cyear.next(true);
		} else {
			// Previous year
			var prev_year = self.cyear.previous();
			if (!prev_year) return;
			self.cyear = prev_year;
		}
	}
	
	// Increment/decrement current season; creates new year if necessary
	function inc_season(direction){
		direction = direction > 0 ? true : false;
		var next_season = direction ? self.cseason.index + 1 : self.cseason.index - 1;
		
		if (next_season > 3){
			// Next season
			next_season = 0;
			self.cyear = self.cyear.next(true);
		} else if (next_season < 0) {
			// Previous season
			next_season = 3;
			var prev_year = self.cyear.previous();
			if (!prev_year) return;
			self.cyear = prev_year;
		}
		
		self.set_season(next_season);
	}
	
	// Set current season
	function set_season(index){
		self.cseason = self.seasons[index];
		self.newplan.crop_id = null;
	}
	
	// Get current farm object of current year
	function cfarm(){
		if (!self.cyear) return {};
		return self.cyear.farm();
	}
	
	// Check if current farm mode is greenhouse
	function in_greenhouse(){
		return self.cmode == "greenhouse" || self.cmode == "ginger_island";
	}
	
	// Toggle current farm mode
	function toggle_mode(){
		if (self.cmode == "farm"){
			set_mode("greenhouse");
		} else if (self.cmode == "greenhouse") {
			set_mode("ginger_island");
		}
		else {
			set_mode("farm");
		}
	}
	
	// Set current farm mode
	function set_mode(mode){
		self.cmode = mode;
		self.cmodeName = mode.replace("_", " ");
	}
	
	////////////////////////////////
	
	// Get season object by id name or date
	function get_season(id){
		// Get season containing a date
		if (typeof id == "number"){
			return self.seasons[Math.floor((id - 1) / SEASON_DAYS)];
		}
		
		// Get season by string ID
		for (var i = 0; i < self.seasons.length; i++){
			if (self.seasons[i].id == id) return self.seasons[i];
		}
	}
	
	// Get formatted date
	function get_date(real_date, format){
		real_date = real_date || self.cdate;
		if (!real_date) return;
		date = real_date % SEASON_DAYS || SEASON_DAYS;
		
		var nth = "th"; // st nd rd th
		if (date <= 3 || date >= 21){
			switch((date % 100) % 10){
				case 1: nth = "st"; break;
				case 2: nth = "nd"; break;
				case 3: nth = "rd"; break;
			}
		}
		
		var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		var day = days[date % 7];
		var season = self.seasons[Math.floor((real_date - 1) / SEASON_DAYS)];
		season = season.name;
		
		var str = format.replace("%l", day)
						.replace("%j", date)
						.replace("%S", nth)
						.replace("%F", season);
		
		return str;
	}
	
	// Set key to sort crop info by
	function ci_set_sort(key){
		if (self.cinfo_settings.sort == key){
			self.cinfo_settings.order = !self.cinfo_settings.order;
		} else {
			self.cinfo_settings.sort = key;
			self.cinfo_settings.order = false;
		}
	}

		// Set key to sort fish info by
		function fi_set_sort(key){
			if (self.cinfo_settings.fish_sort == key){
				self.cinfo_settings.fish_order = !self.cinfo_settings.fish_order;
			} else {
				self.cinfo_settings.fish_sort = key;
				self.cinfo_settings.fish_order = false;
			}
		}
	
	// Filter crops that can be planted in the planner's drop down list
	function planner_valid_crops(crop){
		// calculate season of harvest
		if(!self.cdate) return;
		var harvest_day = self.cdate + crop.grow;
		var rate = 0;

		if(planner.player.agriculturist) rate += 0.1;

		if(self.newplan.fertilizer.id != "none" && self.newplan.fertilizer.growth_rate) {
			rate += self.newplan.fertilizer.growth_rate;
			var remove_days = Math.ceil(crop.grow * rate);
			harvest_day -= remove_days;
		}

		var harvest_season = self.seasons[Math.floor((harvest_day-1)/SEASON_DAYS)];

		return ((crop.can_grow(self.cseason, true) && crop.can_grow(harvest_season, true)) || self.in_greenhouse()) && (!crop.deny || !crop.deny.includes(self.cmode));
	}
	
	
	/********************************
		CLASSES
	********************************/
	/****************
		Sidebar class - controlling the sidebar [single instance]
	****************/
	function Sidebar(){
		var self = this;
		self.mode = "";
		self.crop = null; // crop object
		
		self.keydown = keydown;
		self.open = open_view;
		self.close = close_view;
		self.is_open = is_open;
		self.open_crop = open_crop;
		self.back = back;
		self.export_data = export_data;
		self.import_data = import_data;
		self.legacy_import_data = legacy_import_data;
		
		function keydown(e){
			// Sidebar must be open
			if (!self.is_open()) return;
			
			var event_handled = true;
			if (e.which == 27){
				// ESC
				back();
			} else {
				event_handled = false
			}
			
			if (event_handled){
				e.preventDefault();
				$scope.$apply();
				return true;
			}
		}
		
		function close_view(){
			open_view("");
		}
		
		function is_open(){
			return self.mode != "";
		}
		
		function open_view(view){
			// Toggle off
			if (self.mode == view)
				view = "";
			
			// Clear properties & save on close
			if (!view){
				self.crop = null;
				planner.cinfo_settings.search = "";
				planner.player.save();
				planner.update(null, true);
			} else {
				// Set certain properties on open
				if (planner.cseason.id != "winter")
					planner.cinfo_settings.seasons = [planner.cseason.id];
			}
			
			// Set mode
			self.mode = view;
		}
		
		function back(full_close){
			// back to crop info
			if (self.crop){
				self.crop = null;
				if (!full_close) return;
			}
			
			open_view("");
		}
		
		function open_crop(crop){
			self.mode = "cropinfo";
			self.crop = crop;
		}
		
		function export_data(){
			// Save player
			//planner.player.save();
			
			// Export data
			var out_data = {};
			out_data.plans = LOAD_JSON("plans");
			//out_data.player = LOAD_JSON("player");
			out_data.version = DATA_VERSION;
			out_data.players = LOAD_JSON("players");
			out_data.player = LOAD_JSON("player");
			
			var blob = new Blob([JSON.stringify(out_data)], {type: "octet/stream"});
			var blob_url = window.URL.createObjectURL(blob);
			
			var link = document.createElement("a");
			link.href = blob_url;
			link.style = "display: none";
			link.download = "Crop Planner [" + Date.now() + "]" + ".json";
			document.body.appendChild(link);
			link.click();
		}
		
		function import_data(){
			var input = $("<input type='file' accept='.json'>").appendTo("body");
			input.css("display", "none");
			input.change(read_file);
			input.click();
		}
		
		function read_file(evt){
			var file = evt.target.files[0];
			if (!file) return;
			
			// Read data from JSON file
			var reader = new FileReader;
			reader.onload = function(e){
				var data = {};
				
				try {
					data = JSON.parse(e.target.result);
				} catch(e){
					alert("Not valid JSON data to import.")
					return;
				}
				
				//if (!data.plans || !data.player){
				if (!data.plans){
					alert("Invalid data to import.")
					return;
				}
				
				if (ACCEPTED_VERSIONS.includes(data.version) == -1){
					alert("Incompatible plan version.");
					return;
				}

				var plan_count = 0;
				
				if(data.version == "2") {
					// Load player data
					var players = LOAD_JSON("players", true) ? LOAD_JSON("players") : [];
					if(data.player) {
						var player = new Player(data.player);
						if(!players) {
							players = [player];
						} else {
							players.push(player);
						}

						player.save();
						planner.player = player;
					} else {
						var player_data = {
							level: 0,
							tiller: false,
							agriculturist: false,
							profit_margin: 1,
							id: "player-" + players.length,
							name: "Imported Player " + (players.length + 1),
							settings: {
								show_events: true
							}
						}
						planner.player = new Player(player_data);
					}
					
					// Load plan data
					var plan_data = LOAD_JSON("plans", true) ? LOAD_JSON("plans") : {};

					if(!planner.years) {
						planner.years = {};
					}

					plan_data[planner.player.id] = data.plans;

					$.each(plan_data, function(player_id, plan){
						var player_plans = plan ? plan : [];
						var player_years = [];

						$.each(player_plans, function(i, year_data){
							var new_year = new Year(i);
							plan_count += new_year.set_data(year_data);
							player_years.push(new_year);
						});

						planner.years[player_id] = player_years;
					});

					// Save data
					SAVE_JSON("plans", plan_data);
				} else {
					SAVE_JSON("plans", data.plans);
					SAVE_JSON("players", data.players);
					SAVE_JSON("player", data.player);

					planner.player = new Player(data.player);

					plan_count = load_data();
				}

				planner.cyear = planner.years[planner.player.id][0];
				update(planner.years[planner.player.id][0].data.farm, true); // Update farm
				update(planner.years[planner.player.id][0].data.greenhouse, true); // Update greenhouse
				update(planner.years[planner.player.id][0].data.ginger_island, true); // Update ginger island

				planner.player.save();
				planner.current_player = planner.player.id;
				
				$scope.$apply();
				alert("Successfully imported " + plan_count + " plans into " + planner.years[planner.player.id].length + " year(s).");
				console.log("Imported " + plan_count + " plans into " + planner.years[planner.player.id].length + " year(s).");
			};
			
			reader.readAsText(file);
		}
		
		function legacy_import_data(){
			if (!confirm("This will attempt to import planner data from the old v1 planner, and will overwrite any current plans. This change is not reversible and is not guaranteed to always work. Continue?")) return;
			
			// Load old v1 planner data
			var plan_data = localStorage.getItem("crops");
			if (!plan_data){ alert("No plan data to import"); return; }
			plan_data = JSON.parse(plan_data);
			if (!plan_data){ alert("No plan data to import"); return; }
			
			// Create new plan data
			var new_plans = [{ "farm": {}, "greenhouse": {}, "ginger_island": {} }];
			$.each(plan_data, function(date, plans){
				date = parseInt(date);
				$.each(plans, function(i, plan){
					plan.date = date;
					if (!planner.crops[plan.crop]) return; // Invalid crop
					
					if (plan.greenhouse) {
						if (!new_plans[0].greenhouse[date]) new_plans[0].greenhouse[date] = [];
						delete plan.greenhouse;
						new_plans[0].greenhouse[date].push(plan);
					} else if (plan.ginger_island) {
						if (!new_plans[0].ginger_island[date]) new_plans[0].ginger_island[date] = [];
						delete plan.ginger_island;
						new_plans[0].ginger_island[date].push(plan);
					} else {
						if (!new_plans[0].farm[date]) new_plans[0].farm[date] = [];
						new_plans[0].farm[date].push(plan);
					}
					
					plan_count++;
				});
			});
			
			// Save data
			var save_plans = {
				"player-0": new_plans
			}
			SAVE_JSON("plans", save_plans);
			
			// Reload data and update
			var plan_count = load_data();
			update(planner.years[0].data.farm, true); // Update farm
			update(planner.years[0].data.greenhouse, true); // Update greenhouse
			alert("Successfully imported " + plan_count + " legacy plans into " + planner.years.length + " year(s).");
			console.log("Imported " + plan_count + " legacy plans into " + planner.years.length + " year(s).");
		}
	}
	
	
	/****************
		Player class - user-set player configs [single instance]
	****************/
	function Player(data, dummy_player = false){
		var self = this;
		self.level = 0; // farming level; starts at 0
		self.tiller = false;
		self.agriculturist = false;
		self.current_profit_margin = 1; // Currently applied profit margin
		self.profit_margin = 1; // 100% profit margin
		
		self.load = load
		self.save = save;
		self.toggle_perk = toggle_perk;
		self.quality_chance = quality_chance;
		self.id;
		self.name = "Player";
		
		// Miscellaneous client settings
		self.settings = {
			show_events: true,
		};
		
		
		init();
		
		
		function init(){
			load();
			console.log("Loaded player settings");
		}
		
		// Load player config from browser storage
		function load(){
			var pdata = data ? data : LOAD_JSON("player");
			var players = LOAD_JSON("players", true) ? LOAD_JSON("players") : [];
			if (pdata && !dummy_player) {
				if (pdata.tiller) self.tiller = true;
				if (pdata.agriculturist) self.agriculturist = true;
				if (pdata.level) self.level = pdata.level;
				if (pdata.profit_margin) {
					self.profit_margin = pdata.profit_margin; 
					self.current_profit_margin = pdata.profit_margin;
				}
				if (pdata.settings) self.settings = pdata.settings;
				if (pdata.name) self.name = pdata.name;
				if(pdata.id) {
					self.id = pdata.id;
				} else if(!players) {
					self.id = "player-0";
				}
			} else {
				self.id = "player-" + players.length;
				if(!dummy_player) {
					players.push(self);

					var json_players = [];

					players.forEach(function(player) {
						var player_data = {
							agriculturist: player.agriculturist,
							profit_margin: player.profit_margin,
							id: player.id,
							level: player.level,
							name: player.name,
							settings: player.settings,
							tiller: player.tiller
						}

						json_players.push(player_data);
					});

					self.save();
				} else {
					self.name += " " + players.length;
				}
			}
		}
		
		// Save player config to browser storage
		function save(){
			var pdata = {};
			var players = planner.players;
			var json_players = [];
			if (self.tiller) pdata.tiller = self.tiller;
			if (self.agriculturist) pdata.agriculturist = self.agriculturist;
			pdata.settings = self.settings;
			pdata.level = self.level;
			pdata.profit_margin = self.profit_margin;
			pdata.name = self.name;
			pdata.id = self.id;
			
			// find player in players array and update it
			var found = false;
			players.forEach(function(player, index){
				if(player.id == self.id) {
					players[index] = self;
					found = true;
				}
			});

			if(!found) {
				players.push(pdata);
			}

			players.forEach(function(player) {
				var player_data = {
					agriculturist: player.agriculturist,
					profit_margin: player.profit_margin,
					id: player.id,
					level: player.level,
					name: player.name,
					settings: player.settings,
					tiller: player.tiller
				}

				json_players.push(player_data);
			});

			SAVE_JSON("players", json_players);
			SAVE_JSON("player", pdata);
		}
		
		// Toggle profession perks
		function toggle_perk(key){
			self[key] = !self[key];
			
			// Must have Tiller to have Agriculturist
			if (!self.tiller && key == "tiller"){
				self.agriculturist = false;
			} else if (self.agriculturist && key == "agriculturist"){
				self.tiller = true;
			}
		}
		
		// Get scalar value of chance of crop being 0=regular; 1=silver; 2=gold quality
		// [SOURCE: StardewValley/Crop.cs : function harvest]
		function quality_chance(quality, mult, locale){
			quality = quality || 0;		// Default: check regular quality chance
			mult = mult || 0;			// Multiplier given by type of fertilizer used (0, 1, or 2)
			
			var gold_chance = 0.2 * (self.level / 10) + 0.2 * mult * ((self.level + 2) / 12) + 0.01;
			var silver_chance = Math.min(0.75, gold_chance * 2);
			
			var chance = 0;
			switch (quality){
				case 0:
					chance = Math.max(0, 1 - (gold_chance + silver_chance));
					break;
				case 1:
					chance = Math.min(1, silver_chance);
					break;
				case 2:
					chance = Math.min(1, gold_chance);
					break;
			}
			
			if (locale) return Math.round(chance * 100);
			return chance;
		}

		function select_profit_margin(margin){
			self.profit_margin = margin;
		}
	}
	
	
	/****************
		Season class - representing one of the four seasons
	****************/
	function Season(ind){
		var self = this;
		self.index = ind;
		self.id;
		self.name;
		self.start = 0;
		self.end = 0;
		
		
		init();
		
		
		function init(){
			var seasons = ["spring", "summer", "fall", "winter"];
			self.id = seasons[self.index];
			self.name = self.id.charAt(0).toUpperCase() + self.id.slice(1);
			self.start = (self.index * SEASON_DAYS) + 1;
			self.end = self.start + SEASON_DAYS - 1;
		}
	}
	
	Season.prototype.get_image = function(){
		return "images/seasons/" + this.id + ".png";
	};

	function Weather(ind) {
		var self = this;

		self.index;
		self.id;
		self.name;

		init();

		function init() {
			var weathers = ["sunny", "rainy", "crab_pot"];
			if(isNaN(parseInt(ind))) {
				self.index = weathers.indexOf(ind);
			} else {
				self.index = ind;
			}
			self.id = weathers[self.index];
			if(self.id == "crab_pot") {
				self.name = "Crab Pot";
			} else {
				self.name = self.id.charAt(0).toUpperCase() + self.id.slice(1);
			}
		}
	}

	Weather.prototype.get_image = function(){
		return "images/weather/" + this.id + ".png";
	}
	
	/****************
		Fish class - represents a fish
	****************/
	function Fish(data){
		var self = this;

		// Config properties
		self.id;
		self.name;
		self.seasons = [];
		self.weather = [];
		self.locations = [];
		self.times = [];
		self.isBoss = false;
		self.isLegendary = false;
		self.level = 0;
		self.crab_pot = false;

		init();

		function init() {
			if (!data) return;

			let weathers;

			self.id = data.id;
			self.name = data.name;
			self.seasons = data.seasons;
			if(!data.weather) {
				weathers = ["crab_pot"];
			} else if(data.weather == "both") {
				weathers = ["sunny", "rainy"];
			} else {
				weathers = [data.weather]
			}
			self.locations = data.locations;
			self.times = data.times;
			self.isBoss = data.isBoss;
			self.isLegendary = data.legendary;
			self.level = data.level;
			self.crab_pot = data.crab_pot;

			weathers.forEach(w => {
				self.weather.push(new Weather(w));
			});
		}
	}

	Fish.prototype.get_image = function(){
		return "images/fishes/" + this.id + ".png";
	}

	Fish.prototype.can_catch = function(season, weather) {
		let inSeason = true;
		let inWeather = true;

		if(season && this.seasons) {
			inSeason = false;
			season.forEach(s => {
				if(this.seasons.includes(s)) {
					inSeason = true;
				}
			});
		}

		if(weather && this.weather) {
			inWeather = false;
			weather.forEach(w => {
				this.weather.forEach(fw => {
					if(fw.id == w) {
						inWeather = true;
					}
				});
			});
		}

		return inSeason && inWeather;
	}

	/****************
		Crop class - represents a crop
	****************/
	function Crop(data){
		var self = this;
		
		// Config properties
		self.id;
		self.name;
		self.sell;
		self.buy;
		self.seasons = [];
		self.stages = [];
		self.regrow;
		self.wild = false;
		self.paddy_crop = false;
		
		// Harvest data
		self.harvest = {
			min: 1,
			max: 1,
			experience: 0,
			extra_chance: 0
		};
		
		// Custom properties
		self.note = "";
		self.start = 0;			// Start of grow season(s)
		self.end = 0;			// End of grow season(s)
		self.grow = 0;			// Total days to grow
		self.profit = 0;		// Minimum profit/day (for crops info menu)
		self.fixed_profit = 0;	// Fixed budget profit
		
		
		init();
		
		
		function init(){
			if (!data) return;
			
			// Base properties
			self.id = data.id;
			self.name = data.name;
			self.sell = data.sell;
			self.sell_prices = data.sell_prices;
			self.seasonal_seeds = data.seasonal_seeds;
			self.buy = data.buy;
			self.seasons = data.seasons;
			self.stages = data.stages;
			self.regrow = data.regrow;
			self.deny = data.deny;
			self.paddy_crop = data.paddy_crop;
			if (data.wild) self.wild = true;
			
			// Harvest data
			if (data.harvest.min) {
				self.harvest.min = data.harvest.min;
				if (data.harvest.max > data.harvest.mind) {
					self.harvest.max = data.harvest.max;
				} else {
					self.harvest.max = data.harvest.min;
				}
			}
			if (data.harvest.level_chance) self.harvest.level_chance = data.harvest.level_chance;
			if (data.harvest.experience) self.harvest.experience = data.harvest.experience;
			if (data.harvest.extra_chance) self.harvest.extra_chance = data.harvest.extra_chance;
			
			// Custom properties
			if (data.note) self.note = data.note;
			self.start = get_season(data.seasons[0]).start;
			self.end = get_season(data.seasons[data.seasons.length-1]).end;
			self.grow = 0;
			for (var i = 0; i < data.stages.length; i++){
				self.grow += data.stages[i];
			}

			// Change buy and sell based on player profit margin
			if(planner.player.profit_margin != 1) {
				self.buy = Math.floor(self.buy * planner.player.profit_margin);
				self.sell = Math.floor(self.sell * planner.player.profit_margin);
				if(self.sell_prices) {
					self.sell_prices.min = Math.floor(self.sell_prices.min * planner.player.profit_margin);
					self.sell_prices.max = Math.floor(self.sell_prices.max * planner.player.profit_margin);
				}
			}
			
			// Calculate profit per day
			var season_days = (self.end - self.start) + 1;
			var regrowths = self.regrow ? Math.floor(((season_days - 1) - self.grow) / self.regrow) : 0;
			
			var plantings = 1;
			if (!regrowths) plantings = Math.floor((season_days - 1) / self.grow);
			var growth_days = (plantings * self.grow) + (regrowths * (self.regrow ? self.regrow : 0));
			
			self.profit -= self.buy * plantings;
			self.profit += self.harvest.min * self.get_sell() * (plantings + regrowths);
			self.profit = round(self.profit / growth_days, 1);
			
			// Calculate fixed budget profit
			var budget = 1000; // 1000g worth of seeds
			var plantings = Math.floor(budget / self.buy);
			var growth_days = self.grow + (regrowths * (self.regrow ? self.regrow : 0));
			
			self.fixed_profit -= self.buy * plantings;
			self.fixed_profit += self.harvest.min * self.get_sell() * (plantings + regrowths);
			self.fixed_profit = round((self.fixed_profit / growth_days), 1);
		}
	}
	
	// Get crop quality-modified sell price
	// [SOURCE: StardewValley/Object.cs : function sellToStorePrice]
	Crop.prototype.get_sell = function(quality, max){
		quality = quality || 0;
		max = max || false;
		var sellValue = 0;
		if (!this.seasonal_seeds) {
			sellValue = Math.floor(this.sell * (1 + (quality * 0.25)))
		} else if (max == false) {
			sellValue = Math.floor(this.sell_prices.min * (1 + (quality * 0.25)))
		} else {
			sellValue = Math.floor(this.sell_prices.max * (1 + (quality * 0.25)))
		}
		return sellValue;
	};
	
	// Check if crop can grow on date/season
	Crop.prototype.can_grow = function(date, is_season, in_greenhouse){
		var self = this;
		
		// Expected numeric date, received array of seasons
		if (date.constructor === Array){
			var result = false;
			$.each(date, function(i, v){
				result = result || self.can_grow(v, is_season, in_greenhouse);
				if (result) return false; // break on true
			});
			return result;
		}
		
		if (in_greenhouse && (date <= YEAR_DAYS)) return true;
		if (is_season){
			var season = date;
			if (typeof season == "string") season = planner.get_season(season);
			return (this.start <= season.start) && (this.end >= season.end);
		} else {
			return (date >= this.start) && (date <= this.end);
		}
	};
	
	// Get url to Stardew Valley wiki
	Crop.prototype.get_url = function(){
		var fragment = this.id.split("_");
		for (var i=0; i<fragment.length; i++){
			fragment[i] = fragment[i].charAt(0).toUpperCase() + fragment[i].slice(1);
		}
		fragment = fragment.join("_");
		return "http://stardewvalleywiki.com/Crops#"+fragment;
	};
	
	// Get thumbnail image
	Crop.prototype.get_image = function(seeds){
		if (seeds && this.wild){
			return "images/seeds/wild_"+this.seasons[0]+".png";
		}
		if (seeds) return "images/seeds/"+this.id+".png";
		return "images/crops/"+this.id+".png";
	};
	
	
	/****************
		Year class - yearly plans
	****************/
	function Year(year_index){
		var self = this;
		self.index = 0;
		self.start = 0;
		self.end = 0;
		self.data = {};
		
		
		init();
		
		
		function init(){
			self.index = year_index;
			self.start = (self.index * YEAR_DAYS) + 1;
			self.end = self.start + YEAR_DAYS - 1;

			self.generate_days();

			self.data.farm = new Farm(self);
			self.data.greenhouse = new Farm(self, true);
			self.data.ginger_island = new Farm(self, true, true);
		}
	}
	
	// Return current Farm object based on planner mode
	Year.prototype.farm = function(){
		return this.data[planner.cmode];
	};
	
	// Returns next year
	Year.prototype.next = function(force_create){
		var next_id = this.index + 1;
		if (next_id >= planner.years[planner.player.id].length){
			if (!force_create) return;
			var new_year = new Year(next_id);
			planner.years[planner.player.id].push(new_year);
			return new_year;
		}
		return planner.years[planner.player.id][next_id];
	};
	
	// Returns previous year
	Year.prototype.previous = function(){
		var next_id = this.index - 1;
		if (next_id < 0) return;
		return planner.years[planner.player.id][next_id];
	};
	
	// Get data from year (for saving)
	Year.prototype.get_data = function(){
		var self = this;
		var year_plans = {};
		var total_count = 0;
		
		$.each(self.data, function(type, farm){
			var type_plans = {};
			var type_count = 0;
			
			$.each(farm.plans, function(date, plans){
				if (!plans.length) return;
				type_count += plans.length;
				total_count += plans.length;
				type_plans[date] = [];
				
				$.each(plans, function(i, plan){
					type_plans[date].push(plan.get_data());
				});
			});
			
			if (type_count) year_plans[type] = type_plans;
		});

		year_plans['days'] = self.data.days;
		
		//if (!total_count) return;
		return year_plans;
	};

	// Load data into year (from loading)
	Year.prototype.set_data = function(l_data){
		var self = this;
		var plan_count = 0;
		
		$.each(l_data, function(type, plan_data){
			$.each(plan_data, function(date, plans){
				date = parseInt(date);
				
				$.each(plans, function(i, plan){
					plan.date = date;
					if (!planner.crops[plan.crop]) return; // Invalid crop
					var plan_object = new Plan(plan, type == "greenhouse");
					self.data[type].plans[date].push(plan_object);
					plan_count++;
				});
			});
		});

		if (l_data && l_data.days) self.data.days = l_data.days;
		
		return plan_count;
	};

	// Create the list of days
	Year.prototype.generate_days = function () {
		var self = this;
		self.data.days = {};

		for (var i = 0; i < YEAR_DAYS; i++) {
			self.data.days[i + 1] = new Day(i + 1);
		}
	}

	// Add plan to this farm/year
	Year.prototype.add_plan = function(newplan, date, auto_replant){
		// Validate data
		if (!newplan.crop_id) return false;
		
		// Date out of bounds
		if (date < 1 || date > YEAR_DAYS) return false;
		
		// Check that crop can grow
		var crop = planner.crops[newplan.crop_id];
		if (!crop || !crop.can_grow(date, false, planner.in_greenhouse())) return false;
		newplan.crop = crop;
		
		// Amount to plant
		newplan.amount = parseInt(newplan.amount || 0);
		if (newplan.amount <= 0) return false;
		
		// Add plan
		var plan = new Plan(newplan.get_data(), planner.in_greenhouse());
		plan.date = date;
		this.farm().plans[date].push(plan);
		
		// Auto-replanting within current year
		var crop_growth = plan.get_grow_time();
		var next_planting = date + crop_growth;
		var next_grow = next_planting + crop_growth;
		if (!auto_replant || crop.regrow || (auto_replant && !crop.can_grow(next_grow, false, planner.in_greenhouse()))){
			// Update
			update(this);
			save_data();
		} else if (auto_replant){
			// Auto-replant
			this.add_plan(newplan, next_planting, true);
		}
	};
	
	// Remove plan from current farm/year
	Year.prototype.remove_plan = function(date, index){
		var farm = this.farm();
		if (!farm.plans[date][index]) return;
		var full_update = farm.plans[date][index].crop.regrow;
		farm.plans[date].splice(index, 1);
		save_data();
		update(this, full_update);
	};

	/****************
		Day class - Days
	****************/
	function Day(date) {
		var self = this;
		self.date;
		self.isComplete = false;

		init();

		function init() {
			self.date = date;
		}
	}

	Day.prototype.get_data = function(){
		var data = {};
		data.date = this.date;
		data.isComplete = this.isComplete;

		return data;
	}

	/****************
		Farm class - used only within Year
	****************/
	function Farm(parent_year, is_greenhouse, is_ginger_island){
		var self = this;
		self.year;
		self.greenhouse = false;
		self.ginger = false;
		self.plans = {};
		self.harvests = {};
		self.totals = {};
		
		
		init();
		
		
		function init(){
			self.year = parent_year;
			self.greenhouse = is_greenhouse;
			self.ginger = is_ginger_island;
			
			for (var i = 0; i < YEAR_DAYS; i++){
				self.plans[i + 1] = [];
			}

			self.totals.season = [new Finance, new Finance, new Finance, new Finance];
		}
	}
	
	// Check if farm has crops that regrow; season param optional
	Farm.prototype.has_regrowing_crops = function(season){
		var start_day = 1;
		var end_day = YEAR_DAYS;
		
		if (season){
			start_day = season.start;
			end_day = season.end;
		}
		
		for (var date = start_day; date <= end_day; date++){
			for (var i = 0; i < this.plans[date].length; i++){
				if (this.plans[date][i].crop.regrow){
					return true;
				}
			}
		}
		return false;
	};
	
	// Get image representing farm type
	Farm.prototype.get_image = function(){
		var type = "scarecrow";
		if (this.greenhouse) type = "greenhouse";
		if (this.ginger) type = "ginger_island";

		return "images/" + type + ".png";
	};
	
	/****************
		Harvest class - represents crops harvested on a date
	****************/
	function Harvest(plan, date, is_regrowth){
		var self = this;
		self.date = 0;
		self.plan = {};
		self.crop = {};
		self.yield = {min: 0, max: 0};
		self.revenue = {min: 0, max: 0};
		self.cost = 0;
		self.fertilizerBuy = 0;
		self.profit = {min: 0, max: 0};
		self.is_regrowth = false;
		
		
		init();
		
		
		function init(){
			if (!plan || !date) return;
			var crop = plan.crop;
			self.plan = plan;
			self.crop = crop;
			self.date = date;
			self.buy = plan.buy;
			self.fertilizerBuy = plan.fertilizerBuy;
			
			// Calculate crop yield (+ extra crop drops)
			// [SOURCE: StardewValley/Crop.cs : function harvest]
			self.yield.min = crop.harvest.min * plan.amount;
			self.yield.max = (Math.min(crop.harvest.min + 1, crop.harvest.max + 1 + (crop.harvest.level_chance ? planner.player.level * crop.harvest.level_chance : 0))-1) * plan.amount;
			
			// Harvest revenue and costs
			var q_mult = 0;
			if (plan.fertilizer && !plan.fertilizer.is_none()){
				switch (plan.fertilizer.id){
					case "basic_fertilizer":
						q_mult = 1;
						break;
					case "quality_fertilizer":
						q_mult = 2;
						break;
				}
			}
			
			// Fertilizers expire at the beginning of a new season in the greenhouse
			if (self.plan.greenhouse && (planner.get_season(self.date) != planner.get_season(self.plan.date)))
				q_mult = 0;
			
			// Calculate min/max revenue based on regular/silver/gold chance
			var regular_chance = planner.player.quality_chance(0, q_mult);
			var silver_chance = planner.player.quality_chance(1, q_mult);
			var gold_chance = planner.player.quality_chance(2, q_mult);

			var min_revenue = crop.get_sell(0);
			var max_revenue = (min_revenue*regular_chance) + (crop.get_sell(1)*silver_chance) + (crop.get_sell(2)*gold_chance);
			max_revenue = Math.min(crop.get_sell(2), max_revenue);

			if(crop.seasonal_seeds) {
				min_revenue = crop.get_sell(0, false);
				max_revenue = (crop.get_sell(0, true)*regular_chance) + (crop.get_sell(1, true)*silver_chance) + (crop.get_sell(2, true)*gold_chance);
			}
			
			// Quality from fertilizer only applies to picked harvest
			// and not to extra dropped yields
			self.revenue.min = Math.floor(min_revenue) * self.yield.min;
			self.revenue.max = Math.floor(max_revenue) + (Math.floor(min_revenue) * Math.max(0, self.yield.max - 1));
			self.cost = (self.buy * plan.amount) + (parseInt(self.fertilizerBuy) == isNaN() ? 0 : plan.get_fertilizer_cost());
			
			// Tiller profession (ID 1)
			// [SOURCE: StardewValley/Object.cs : function sellToStorePrice]
			if (planner.player.tiller){
				self.revenue.min = Math.floor(self.revenue.min * 1.1);
				self.revenue.max = Math.floor(self.revenue.max * 1.1);
			}
			
			// Regrowth
			if (is_regrowth){
				self.is_regrowth = true;
			}
			
			// Harvest profit
			self.profit.min = self.revenue.min - self.cost;
			self.profit.max = self.revenue.max - self.cost;
		}
	}
	
	Harvest.prototype.get_cost = function(locale){
		if (locale) return this.cost.toLocaleString();
		return this.cost;
	};
	
	Harvest.prototype.get_revenue = function(locale, max){
		var value = max ? this.revenue.max : this.revenue.min;
		if (locale) return value.toLocaleString();
		return value;
	};
	
	Harvest.prototype.get_profit = function(locale, max){
		var value = max ? this.profit.max : this.profit.min;
		if (locale) return value.toLocaleString();
		return value;
	};

	Harvest.prototype.get_previous_harvest = function() {
		var harvestIndex;
		var previous_harvest;
		if(this.plan.harvests && this.plan.harvests.length > 1) {
			harvestIndex = this.plan.harvests.indexOf(this);
			previous_harvest = this.plan.harvests[harvestIndex - 1];
		} else {
			previous_harvest = null;
		}

		return previous_harvest;
	}

	Harvest.prototype.update_cost = function() {
		var prev_harvest = this.get_previous_harvest();
		if(!prev_harvest) {
			this.cost = 0;
		} else {
			this.cost = prev_harvest.get_profit(1);

			if(this.cost > 0) {
				this.cost = 0;
			} else if (this.cost < 0){
				this.cost = Math.abs(this.cost);
			}

			// Harvest profit
			this.profit.min = this.revenue.min - this.cost;
			this.profit.max = this.revenue.max - this.cost;
		}
	}

	Harvest.prototype.get_experience = function() {
		return this.plan.crop.harvest.experience * this.plan.amount;
	}
	
	
	/****************
		Plan class - represents seeds planted on a date
	****************/
	function Plan(data, in_greenhouse){
		var self = this;
		self.date;
		self.crop_id;
		self.crop = {};
		self.amount = 1;
		self.fertilizer = planner.fertilizer["none"];
		self.fertilizerBuy;
		self.harvests = [];
		self.greenhouse = false;
		self.buy;
		self.id;
		
		
		init();
		
		
		function init(){
			if (!data) return;
			self.date = data.date;
			self.crop = planner.crops[data.crop];
			self.amount = data.amount;
			self.buy = data.buy != null && data.buy != "" && data.buy != undefined && data.buy != self.crop.buy ? data.buy : self.crop.buy;
			if (data.fertilizer && planner.fertilizer[data.fertilizer]) {
				self.fertilizer = planner.fertilizer[data.fertilizer];
				self.fertilizerBuy = data.fertilizerBuy != null && data.fertilizerBuy != "" && data.fertilizerBuy != undefined && data.fertilizerBuy != self.fertilizer.buy ? data.fertilizerBuy : self.fertilizer.buy;
			} else {
				self.fertilizer = planner.fertilizer["none"];
				self.fertilizerBuy = 0;
			}
			
			self.greenhouse = in_greenhouse ? true : false;
		}
	}
	
	// Compile data to be saved as JSON
	Plan.prototype.get_data = function(){
		var data = {};
		data.crop = this.crop.id;
		data.amount = this.amount;
		data.buy = this.buy;
		if (this.fertilizer && !this.fertilizer.is_none()) {
			data.fertilizer = this.fertilizer.id;
			data.fertilizerBuy = this.fertilizerBuy;
		}
		return data;
	};
	
	Plan.prototype.get_grow_time = function(){
		var stages = $.extend([], this.crop.stages);
		
		if (this.fertilizer.id || planner.player.agriculturist){
			// [SOURCE: StardewValley.TerrainFeatures/HoeDirt.cs : function plant]
			var rate = 0;
			if(this.fertilizer.id != "none") {
				rate = this.fertilizer.growth_rate;
			}
			
			// Agriculturist profession (ID 5)
			if (planner.player.agriculturist) rate += 0.1;
			
			// Days to remove
			var remove_days = Math.ceil(this.crop.grow * rate);
			
			// For removing more than one day from larger stages of growth
			// when there are still days to remove
			var multi_remove = 0;
			
			// Remove days from stages
			while (remove_days > 0 && multi_remove < 3){
				for (var i = 0; i < stages.length; i++){
					if (i > 0 || stages[i] > 1){
						stages[i] -= 1;
						remove_days--;
					}
					
					if (remove_days <= 0) break;
				}
				
				multi_remove++;
			}
		}
		
		// Add up days of growth
		var days = 0;
		for (var i = 0; i < stages.length; i++){
			days += stages[i];
		}
		
		return days;
	};
	
	Plan.prototype.get_cost = function(locale){
		var amount = (this.buy * this.amount) + (parseInt(this.fertilizerBuy) == isNaN() ? 0 : this.get_fertilizer_cost());
		if (locale) return amount.toLocaleString();
		return amount;
	};

	Plan.prototype.get_seed_cost = function(locale){
		var amount = this.buy * this.amount;
		if (locale) return amount.toLocaleString();
		return amount;
	}

	Plan.prototype.get_fertilizer_cost = function(locale){
		var amount = this.fertilizerBuy * this.amount;
		if (locale) return amount.toLocaleString();
		return amount;
	}
	
	Plan.prototype.get_revenue = function(locale, max){
		var amount = 0;
		for (var i = 0; i < this.harvests.length; i++){
			amount += max ? this.harvests[i].revenue.max : this.harvests[i].revenue.min;
		}
		if (locale) return amount.toLocaleString();
		return amount;
	};
	
	Plan.prototype.get_profit = function(locale, max){
		var amount = this.get_revenue(max) - this.get_cost();
		if (locale) return amount.toLocaleString();
		return amount;
	};
	
	
	/****************
		Fertilizer class - represents a type of fertilizer
	****************/
	function Fertilizer(data){
		var self = this;
		self.id;
		self.name;
		self.buy = 0;
		self.quality = [0, 0, 0]; // for quality-modifying fertilizers
		self.growth_rate = 0; // for growth-modifying fertilizers
		
		
		init();
		
		
		function init(){
			if (!data) return;
			self.id = data.id;
			self.name = data.name;
			self.buy = data.buy;
			if (data.quality) self.quality = data.quality;
			if (data.growth_rate) self.growth_rate = data.growth_rate;
		}
	}
	
	// Check if fertilizer is not being used ("none" type)
	Fertilizer.prototype.is_none = function(){
		return this.id == "none";
	};
	
	// Get fertilizer image
	Fertilizer.prototype.get_image = function(){
		if (!this.is_none()) return "images/fertilizer/" + this.id + ".png";
	};
	
	
	/****************
		Finance class - datatype for storing financial details of a day/season/year
	****************/
	function Finance(){
		var self = this;
		self.cost = 0;
		self.revenue = {min: 0, max: 0};
		self.profit = {min: 0, max: 0};
		
		self.plantings = 0; // planting count
		self.harvests = {min: 0, max: 0}; // harvest count
	}
	
	// Return cost value
	Finance.prototype.get_cost = function(locale){
		if (locale) return this.cost.toLocaleString();
		return this.cost;
	};
	
	// Return revenue value (min or max)
	Finance.prototype.get_revenue = function(locale, max){
		var value = max ? this.revenue.max : this.revenue.min;
		if (locale) return value.toLocaleString();
		return value;
	};
	
	// Return profit value (min or max)
	Finance.prototype.get_profit = function(locale, max){
		var value = max ? this.profit.max : this.profit.min;
		if (locale) return value.toLocaleString();
		return value;
	};
	
	// Return plantings count
	Finance.prototype.get_plantings = function(locale){
		if (locale) return this.plantings.toLocaleString();
		return this.plantings;
	};
	
	// Return harvests count (min or max)
	Finance.prototype.get_harvests = function(locale, max){
		var value = max ? this.harvests.max : this.harvests.min;
		if (locale) return value.toLocaleString();
		return value;
	};
	
	
	/****************
		Calendar Event class - event on the calendar
	****************/
	function CalendarEvent(data){
		var self = this;
		self.day;
		self.season;
		
		self.date;
		self.name = "";
		self.festival = false;
		
		
		init();
		
		
		function init(){
			if (!data) return;
			self.day = data.day;
			self.season = planner.seasons[data.season];
			
			self.date = (data.season * SEASON_DAYS) + self.day;
			self.name = data.name;
			self.festival = data.festival;
		}
	}
	
	// Get event image
	CalendarEvent.prototype.get_image = function(){
		if (this.festival) return "images/flag.gif";
		return "images/people/" + this.name.toLowerCase() + ".png";
	};
	
	// Get readable text of event
	CalendarEvent.prototype.get_text = function(){
		if (!this.festival) return this.name + "'s Birthday";
		return this.name;
	};

	// Get date
	CalendarEvent.prototype.get_date = function () {
		return this.cal_date;
	};
	
	
	/********************************
		RUN INITIALIZATION
	********************************/
	// Initialization runs last since Function.prototype methods
	// aren't hoisted
	init();
}