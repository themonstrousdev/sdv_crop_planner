#!/usr/bin/env python3
################################
# Development tool
# Updates config.json using XNBNode to decompile
# game files
#
# Requires:
#	https://github.com/draivin/XNBNode
#	xcompress32.dll - proprietary, not included with XNBNode
################################

import os, sys, shutil, json
from os.path import getmtime
from collections import OrderedDict

import math

# For downloading XNBNode (on user prompt)
# Not used for now
from io import BytesIO
from zipfile import ZipFile
from urllib.request import urlopen

from _helper import *

'''
Notes:
	-StardewValley/Crops.cs
		Info about crop harvesting and quality crop chances
	-StardewValley/Farmer.cs
		Player class
	-StardewValley/Object.cs
		General info about objects (names, prices, sell price, etc.)
	-StardewValley.TerrainFeatures/HoeDirt.cs
		Info about crop planting and speed-gro boosts
'''


# Main application
class Main:
	# Local app config
	s = {}
	settings_path = "data/update-config-settings.json"
	xnbhelper_url = "https://github.com/Pathoschild/StardewXnbHack/releases"
	
	# Path variables
	p = {}
	
 # Get current folder
	current_folder = os.path.abspath(os.getcwd())
	source_directory = os.path.dirname(current_folder)
 
	config_path = source_directory + "/v3/config.json"
	temp_dir = "data/temp/"
	data_dir = "/Content/Data/"
	unpacked_dir = "/Content (Unpacked)/Data/"
	
	# Crop data
	objects = {}
	crops = {}
	force = False
	
	def __init__(self):
		# Make sure config for this script exists
		self.init_config()
		clear()
		
		# Existing paths
		self.p["game"] = os.path.abspath(self.s["game_path"] + self.unpacked_dir) + "/"
		self.p["xnb"] = self.s["xnbnode_path"] + "/"
		
		header("Crop Planner - Data Updater")
		
		# Check if forcing update
		print()
		self.update_files();
		self.get_objects()
		self.get_crops()
		self.get_fish()
		self.get_locations()
		self.get_shops()
		self.get_gifts()
		self.arrange_crops()
		self.arrange_fish()
		self.update_config()
  
		print("Done")
		
	def init_config(self):
		clear()
		header("Crop Planner - Data Updater\nConfig Setup")
		
		# ../config.json must exist
		if not os.path.exists(self.config_path):
			print("Error: Missing ../config.json file. Quitting")
			sys.exit(1)
			
		# Create dirs
		os.makedirs("data", exist_ok=True)
		os.makedirs(self.temp_dir, exist_ok=True)
		os.makedirs(self.temp_dir + "sources", exist_ok=True)
		
		paths_exist = True
		
		# Get / create settings file for this script
		if not os.path.exists(self.settings_path):
			f = open(self.settings_path, "w")
			f.write("{}")
			f.close()
			paths_exist = False
		else:
			with open(self.settings_path, "r") as f:
				try:
					self.s = json.load(f)
				except:
					pass
		
		# Get game path
		if (not "game_path" in self.s) or (not os.path.exists(os.path.abspath(self.s["game_path"] + self.unpacked_dir))):
			paths_exist = False
			while True:
				inp = self.query_path_exists("Stardew Valley installation path")
				
				if not os.path.exists(os.path.abspath(inp + self.data_dir)):
					clear()
					print("Invalid Stardew Valley path, look for the directory with Stardew Valley.exe")
					continue
					
				if not os.path.exists(inp + "StardewXnbHack.exe"):
					clear()
					print("StardewXnbHack.exe not found in Stardew Valley directory. Please download from:\n" + self.xnbhelper_url)
					continue
   
				if not os.path.exists(inp + self.unpacked_dir):
					clear()
					print("Unpacked data not found. Please unpack the game files using StardewXnbHack.exe")
					continue
   
				self.s["game_path"] = inp
				break
		# Write settings to file if necessary
		if not paths_exist:
			with open(self.settings_path, "w") as f:
				json.dump(self.s, f, ensure_ascii=False, indent="\t")
	
	def query_path_exists(self, name):
		while True:
			inp = input(name + ": ")
			if os.path.exists(inp):
				return inp
			else:
				print("Invalid path")

	def update_files(self):
		source_files = [
			["Crops", "crops"],
			["Objects", "objects"],
			["Fish", "fish"],
			["Shops", "shops"],
			["Locations", "locations"],
			["NPCGiftTastes", "gifts"]
		]
		
		# Copy files from game directory
		i = 0
		is_outdated = False
		for src in source_files:
			src_name = src[0]
			dec_name = src[1]
			source_path = os.path.abspath(self.p["game"] + src_name + ".json")
			copy_dest = os.path.abspath(self.temp_dir + "sources/" + dec_name + ".json")

			print("Copying " + src_name + "...")
			if (not os.path.exists(copy_dest)) or (os.path.getmtime(source_path) > os.path.getmtime(copy_dest)):
				is_outdated = True
				shutil.copyfile(source_path, copy_dest)
				print("...updated")
			else:
				print("...up to date")

			if i < len(source_files): print()
			i += 1
    

	def get_objects(self):
    # Read objects from objects.json
		src_path = self.temp_dir + "sources/objects.json"
		self.objects = {}
		if os.path.exists(src_path):
			objects_file = open(src_path, "r")
			objects_file = json.load(objects_file)
   
  		# Get all objects
			for obj in objects_file:
				self.objects[obj] = {
          "name": objects_file[obj]["Name"],
          "price": objects_file[obj]["Price"],
          "type": objects_file[obj]["Type"]
        }
		else:
			print("Error: Objects file not found")
					
	def get_crops(self):
    # Read crops from crops.json
		src_path = self.temp_dir + "sources/crops.json"
		self.crops = {}
		if os.path.exists(src_path):
			crops_file = open(src_path, "r")
			crops_file = json.load(crops_file)
   
  		# Get Crop Seeds
			for crop in crops_file:
				self.crops[crop] = {
          "stages": crops_file[crop]["DaysInPhase"],
          "seasons": crops_file[crop]["Seasons"],
          "harvest": {
            "min": crops_file[crop]["HarvestMinStack"],
            "max": crops_file[crop]["HarvestMaxStack"],
            "level_chance": crops_file[crop]["HarvestMaxIncreasePerFarmingLevel"],
            "extra_chance": crops_file[crop]["ExtraHarvestChance"]
					},
          "paddy_crop": crops_file[crop]["IsPaddyCrop"],
          "regrow": crops_file[crop]["RegrowDays"],
          "crop": crops_file[crop]["HarvestItemId"],
          "scythe": crops_file[crop]["HarvestMethod"] == "Scythe",
          "plant_rules": crops_file[crop]["PlantableLocationRules"][0]["Id"] if crops_file[crop]["PlantableLocationRules"] else None
        }
     
		else:
			print("Error: Crops file not found")

	def get_fish(self):
    # Read fish from fish.json
		src_path = self.temp_dir + "sources/fish.json"
		self.fish = {}
		if os.path.exists(src_path):
			fish_file = open(src_path, "r")
			fish_file = json.load(fish_file)
   
  		# Categorize Fish
			for fish in fish_file:
				fish_data = fish_file[fish].split("/")
				if(len(fish_data) < 8):
					print("Invalid fish: (" + fish + ") " + fish_data[0] + ". Skipping...")
				elif(len(fish_data) < 14):
					self.fish[fish] = {
						"name": fish_data[0],
						"crab_pot": True if fish_data[1] == "trap" else False,
						"chance": fish_data[2],
						"locations": [fish_data[4]]
					}
				else:
					times = fish_data[5].split(" ")
					if len(times) > 2:
						times = [times[0] + ' - ' + times[1], times[2] + ' - ' + times[3]]
					else:
						times = [times[0] + ' - ' + times[1]]
					self.fish[fish] = {
						"name": fish_data[0],
						"crab_pot": False,
						"difficulty": fish_data[1],
						"times": times,
						"seasons": fish_data[6].split(" "),
						"weather": fish_data[7],
						"fishing_level": fish_data[12]
					}
		else:
			print("Error: Fish file not found")

	def get_locations(self):
    # Read locations from locations.json
		src_path = self.temp_dir + "sources/locations.json"
		self.locations = {}
		if os.path.exists(src_path):
			locations_file = open(src_path, "r")
			locations_file = json.load(locations_file)
   
  		# Get all locations
			for loc in locations_file:
				if (not loc == "Default") and ("Farm" not in loc) and ("Backwoods" not in loc) and ("Game" not in loc) and ("Temp" not in loc):
					fishes_in_loc = list()
					loc_name = loc
					for fish in locations_file[loc]["Fish"]:
						if "(O)" in fish["Id"] or "(O)" in fish["ItemId"]:
							tempFish = {
								"season": fish["Season"],
								"fishing_level": fish["MinFishingLevel"],
								"boss_fish": fish["IsBossFish"],
							}
       
							if fish["ItemId"] is not None:
								tempFish["id"] = fish["ItemId"][3:]
       
							if fish["Condition"]:
								tempFish["legendary"] = "LEGENDARY_FAMILY" in fish["Condition"]
							else:
								tempFish["legendary"] = False
       
							if fish["FishAreaId"]:
								tempFish["area_id"] = fish["FishAreaId"]
       
							if fish["ItemId"] is None and "|" in fish["Id"]:
								ids = fish["Id"].split("|")
								for i in ids:
									tempFish["id"] = i[3:]
									fishes_in_loc.append(tempFish)
							else:
								fishes_in_loc.append(tempFish)

					if "Island" in loc:
						# Change "Island" to "GingerIsland"
						loc_name = loc.replace("Island", "GingerIsland")
      
					if loc == "Caldera":
						loc_name = "GingerIslandVolcanoCaldera"
      
					self.locations[loc_name] = {
						"name": loc_name,
						"fish_areas": list(locations_file[loc]["FishAreas"].keys()),
						"fish": fishes_in_loc
					}
		else:
			print("Error: Locations file not found")
   
	def get_shops(self):
    # Read shops from shops.json
		src_path = self.temp_dir + "sources/shops.json"
		npc_path = self.temp_dir + "sources/gifts.json"
		self.shops = {}
		if os.path.exists(src_path) and os.path.exists(npc_path):
			shops_file = open(src_path, "r")
			shops_file = json.load(shops_file)
			npcs_file = open(npc_path, "r")
			npcs_file = json.load(npcs_file)
			npcs = list()
   
			for npc in npcs_file:
				if "Universal" not in npc:
					npcs.append(npc)
     
  		# Get all locations
			for shop in shops_file:
				items = list()

				for item in shops_file[shop]["Items"]:
					if (item["ItemId"]) and ("(O)" in item["ItemId"]):
						tempItem = {
							"id": item["ItemId"][3:],
							"price": item["Price"],
							"price_modifiers": item["PriceModifiers"],
							"price_modifier_mode": item["PriceModifierMode"]
						}
      
						if item["TradeItemId"]:
							tempItem["trade_item"] = item["TradeItemId"][3:] if "(O)" in item["TradeItemId"] else item["TradeItemId"]
							tempItem["trade_item_amount"] = item["TradeItemAmount"]
      
						items.append(tempItem)
			
				self.shops[shop] = {
					"name": shop,
					"items": items,
					"price_modifiers": shops_file[shop]["PriceModifiers"],
				}
		else:
			print("Error: Shops or NPC Gifts file not found")
   
	def get_gifts(self):
		# Read gifts from gifts.json
		src_path = self.temp_dir + "sources/gifts.json"
		self.loved = {}
		if os.path.exists(src_path):
			gifts_file = open(src_path, "r")
			gifts_file = json.load(gifts_file)
			npcs = list()

			for npc in npcs:
				self.loved[npc] = list()
    
				# Add universally loved gifts
				for gift in gifts_file["Universal_Love"].split(" "):
					self.loved[npc].append(gift)
     
				# Add specific loved gifts
				dialogues = gifts_file[npc].split("/")
				loved_gifts = dialogues[1].split(" ")
				for gift in loved_gifts:
					self.loved[npc].append(gift)     
		else:
			print("Error: NPC Gifts file not found")

	def arrange_crops(self):
		if (not len(self.crops)) or (not len(self.objects)) or (not len(self.shops)):
			print("Error: Some files are missing")
			return
		
		# seasonal seeds
		seasonal_seeds = [ "495", "496", "497", "498" ]
  
		# crops for seasonal seeds
		seasonal_crops = {
			"495": ["18", "22", "20", "16"],
			"496": ["398", "396", "402"],
			"497": ["410", "404", "408", "406"],
			"498": ["418", "414", "416", "412"]
		}
  
		if not hasattr(self, "config"):
			self.config = {}
   
		self.config["crops"] = {};
  
  	# Get crop data
		for cropId in self.crops:
			crop = self.crops[cropId]
			crop_data = {
				"buy": 0,
				"harvest": {}
			}
   
			# Get buy price from shops
			for shop in self.shops:
				for item in self.shops[shop]["items"]:
					if item["id"] == cropId and shop != "Joja":
						# check if seed shop
						if crop_data["buy"] <= 0 or (item["price"] <= crop_data["buy"] and item["price"] > 0):
							if (shop == "SeedShop" and item["price"] == -1) or (shop == "Sandy" and item["price"] == -1):
								crop_data["buy"] = self.objects[cropId]["price"] * 2
							else:
								crop_data["buy"] = item["price"]
        
						if crop_data["buy"] == -1:
							crop_data["buy"] = 0
        
			if cropId in seasonal_seeds:
				# get all prices of seasonal crop
				prices = []
				for seosonalCropId in seasonal_crops[cropId]:
					prices.append(self.objects[seosonalCropId]["price"])

				# Get smallest amount
				crop_data["sell_prices"] = {
					"min": min(prices),
					"max": max(prices)
				}

    
				seasonal_seed_name = self.objects[cropId]["name"]
				crop_data["seasonal_seeds"] = True
				crop_data["id"] = seasonal_seed_name.lower().replace(" ", "_")
				crop_data["index"] = int(cropId) if cropId.isnumeric() else cropId
				crop_data["name"] = seasonal_seed_name
			else:
				# Get name of harvested crop
				harvested_crop = self.objects[crop["crop"]]
				if (crop["harvest"]["min"] != crop["harvest"]["max"]) or (crop["harvest"]["min"] > 1):
					crop_data["harvest"]["min"] = crop["harvest"]["min"]
					crop_data["harvest"]["max"] = crop["harvest"]["max"]
				
				if crop["harvest"]["level_chance"] != 0:
					crop_data["harvest"]["level_chance"] = crop["harvest"]["level_chance"]
			
				if crop["harvest"]["extra_chance"] != 0:
					crop_data["harvest"]["extra_chance"] = crop["harvest"]["extra_chance"]
		
				crop_data["id"] = harvested_crop["name"].lower().replace(" ", "_")
				crop_data["index"] = int(cropId) if cropId.isnumeric() else cropId
				crop_data["name"] = harvested_crop["name"]
			
			if crop["regrow"] > 0:
				crop_data["regrow"] = crop["regrow"]
   
			if crop["paddy_crop"]:
				crop_data["paddy_crop"] = crop["paddy_crop"]
    
			if crop["scythe"]:
				crop_data["scythe"] = crop["scythe"]
			
			crop_data["seasons"] = list()
   
			for season in crop["seasons"]:
				crop_data["seasons"].append(season.lower())
    
			# Get sell data
			if cropId in seasonal_seeds:
				crop_data["sell"] = 0
			else:
				crop_data["sell"] = harvested_crop["price"]
    
			if not crop_data["sell"] == 0:
				crop_data["harvest"]["experience"] = self.calculate_xp(crop_data["sell"])
    
				if crop_data["harvest"]["experience"] < 0:
					crop_data["harvest"]["experience"] = crop_data["harvest"]["experience"] * -1
   
			# Get stages
			crop_data["stages"] = crop["stages"]
   
			# Get plant rules
			if crop["plant_rules"]:
				if(crop["plant_rules"] == "NotOutsideUnlessGingerIsland"):
					crop_data["deny"] = ["farm"]
   
			self.config["crops"][crop_data["id"]] = crop_data

	def calculate_xp(self, price):
		xp = round(16 * math.log(0.018 * price + 1))
		if xp < 0:
			xp = xp * -1
		return xp

	def split_words(self, text):
		words = []
		textArr = list(text)
		word = ""
  
		for letter in textArr:
			if letter.isupper() and word != "":
				words.append(word)
				word = ""
    
			word += letter
  
		if word != "":
			words.append(word)
   
		return " ".join(words)

	def arrange_fish(self):
		if not len(self.fish) or not len(self.locations):
			print("Error: Some files are missing")
			return
 
		if not hasattr(self, "config"):
			self.config = {}
 
		self.config["fish"] = {}
  
		# Get fish data
		for fishId in self.fish:
			fish = self.fish[fishId]
			fish_data = {
				"index": int(fishId) if fishId.isnumeric() else fishId,
				"name": self.fish[fishId]["name"],
				"crab_pot": self.fish[fishId]["crab_pot"],
				"id": self.fish[fishId]["name"].lower().replace(" ", "_")
			}
   
			if fish_data["crab_pot"]:
				fish_data["chance"] = fish["chance"]
				fish_data["locations"] = fish["locations"]
				fish_data["times"] = []
				fish_data["legendary"] = False
			else:
				fish_data["difficulty"] = fish["difficulty"]
				fish_data["times"] = []

				for time in fish["times"]:
					# Get first hour
					start_time = time.split(" - ")[0]
					end_time = time.split(" - ")[1]

					if len(start_time) < 4:
						start_time = "0" + start_time
      
					if len(end_time) < 4:
						end_time = "0" + end_time
      
					start_time_hour = start_time[0:2]
					start_time_minute = start_time[2:]
					start_time_tod = "AM"
    
					if start_time_hour == "00":
						start_time_hour = "12"
						start_time_tod = "AM"
					elif start_time_hour >= "12":
						while int(start_time_hour) > 12:
							start_time_hour = str(int(start_time_hour) - 12)
							
							if start_time_tod == "AM":
								start_time_tod = "PM"
							else:
								start_time_tod = "AM"
     
					end_time_hour = end_time[0:2]
					end_time_minute = end_time[2:]
					end_time_tod = "AM"
			
					if end_time_hour == "00":
						end_time_hour = "12"
						end_time_tod = "AM"
					elif end_time_hour >= "12":
						while int(end_time_hour) > 12:
							end_time_hour = str(int(end_time_hour) - 12)
							
							if end_time_tod == "AM":
								end_time_tod = "PM"
							else:
								end_time_tod = "AM"
       
					timeframe = start_time_hour + ":" + start_time_minute + " " + start_time_tod + " - " + end_time_hour + ":" + end_time_minute + " " + end_time_tod;
					fish_data["times"].append(timeframe)
    
				fish_data["seasons"] = fish["seasons"]
				fish_data["weather"] = fish["weather"]
    
				fish_data["fishing_level"] = fish["fishing_level"]

				# Get locations
				fish_data["locations"] = list()
				for loc in self.locations:
					for loc_fish in self.locations[loc]["fish"]:
						if loc_fish["id"] == fishId:
							temp_location = self.split_words(loc)
							
							if hasattr(loc_fish, "area_id"):
								temp_location += " (" + self.split_words(loc_fish["area_id"]) + ")"
							
							if temp_location not in fish_data["locations"]:
								fish_data["locations"].append(temp_location)

							fish_data["legendary"] = loc_fish["legendary"]
        
							fish_data["isBoss"] = loc_fish["boss_fish"]
        
							fish_data["fishing_level"] = loc_fish["fishing_level"]

				if fishId == "Goby":
					fish_data["locations"].append("Waterfalls (Next to Hat Mouse)")

				if fishId == "161":
					fish_data["locations"].append("Underground Mines (Lvl 60)")
     
				if fishId == "158":
					fish_data["locations"].append("Underground Mines (Lvl 20)")
     
				if fishId == "162":
					fish_data["locations"].append("Underground Mines (Lvl 100)")
					
			self.config["fish"][fish_data["id"]] = fish_data

	def update_config(self):
		missing = list()
		error_string = "Error: Missing Data\n"
  
		if not len(self.config["crops"]):
			missing.append("Crops")
		
		if not len(self.config["fish"]):
			missing.append("Fish")
   
		if len(missing):
			print(error_string)
			for m in missing:
				print("- " + m + "\n")
			return
  
		print("config.json:")
		
		# Read config file
		config = {}
		with open(self.config_path, "r") as config_file:
			try:
				config = json.load(config_file, object_pairs_hook=OrderedDict)
			except:
				print("...failed to read JSON")
				return
				
		# Alert on differences
		# config["crops"] = old; self.crops = new
		differences = ""
		p = "   ..."
		for crop in config["crops"]:
			if crop["id"] not in self.config["crops"]:
				print("...Crop ID '" + crop["id"] + "' discarded")
				continue
				
			check = self.config["crops"][crop["id"]]
			
			if crop["buy"] != check["buy"]:
				differences += p+"buy price is different\n"
				
			if crop["sell"] != check["sell"]:
				differences += p+"sell price is different\n"
				
			if len(crop["stages"]) != len(check["stages"]):
				differences += p+"stages are different\n"
			else:
				s_index = 0
				for s in crop["stages"]:
					if crop["stages"][s_index] != check["stages"][s_index]:
						differences += p+"stages are different\n"
						break
					s_index += 1
						
			if len(differences):
				print("..."+crop["name"]+" differences:\n" + differences)
				differences = ""
			
		# Sort crops alphabetically
		crop_ids = []
		for c_id in self.config["crops"]:
			crop_ids.append(c_id)
		crop_ids = sorted(crop_ids, key=str.lower)
		
  
		# Alert on differences
		# config["fish"] = old; self.fish = new
		differences = ""
		p = "   ..."
		for fish in config["fishes"]:
			if fish["id"] not in self.config["fish"]:
				print("...Fish ID '" + fish["id"] + "' discarded")
				continue
				
			check = self.config["fish"][fish["id"]]
			
			if check["crab_pot"]:
				if fish["chance"] != check["chance"]:
					differences += p+"chance is different\n"
					
				if len(fish["locations"]) != len(check["locations"]):
					differences += p+"location is different\n"
				else:
					l_index = 0
					for l in fish["locations"]:
						if fish["locations"][l_index] != check["locations"][l_index]:
							differences += p+"location is different\n"
							break
						l_index += 1
			else:
				if fish["difficulty"] != check["difficulty"]:
					differences += p+"difficulty is different\n"
					
				if len(fish["times"]) != len(check["times"]):
					differences += p+"times are different\n"
				else:
					t_index = 0
					for t in fish["times"]:
						if fish["times"][t_index] != check["times"][t_index]:
							differences += p+"times are different\n"
							break
						t_index += 1
					
				if len(fish["seasons"]) != len(check["seasons"]):
					differences += p+"seasons are different\n"
				else:
					s_index = 0
					for s in fish["seasons"]:
						if fish["seasons"][s_index] != check["seasons"][s_index]:
							differences += p+"seasons are different\n"
							break
						s_index += 1
						
				if fish["weather"] != check["weather"]:
					differences += p+"weather is different\n"
					
				if fish["fishing_level"] != check["fishing_level"]:
					differences += p+"fishing level is different\n"
     
				if fish["legendary"] != check["legendary"]:
					differences += p+"legendary is different\n"
					
				if len(differences):
					print("..."+fish["name"]+" differences:\n" + differences)
					differences = ""
     
    # Sort fish alphabetically
		fish_ids = []
		for f_id in self.config["fish"]:
			fish_ids.append(f_id)
		fish_ids = sorted(fish_ids, key=str.lower)
  
		# Update config file
		config["crops"] = []
		for c_id in crop_ids:
			config["crops"].append(self.config["crops"][c_id])
   
		config["fishes"] = []
		for f_id in fish_ids:
			config["fishes"].append(self.config["fish"][f_id])
		
		with open(self.config_path, "w") as config_file:
			json.dump(config, config_file, ensure_ascii=False, indent="\t")
		
		print("...updated")
		
		
		
# Run application
if __name__ == "__main__":
	try:
		app = Main()
	except KeyboardInterrupt:
		print("\nExiting")