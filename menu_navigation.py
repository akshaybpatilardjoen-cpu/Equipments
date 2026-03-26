import os

# 1. Configuration for the 8 Units
units = [f"UNIT{i}" for i in range(1, 9)]
depts = ["ADMIN", "ELECTRICAL", "MECHANICAL", "INSTRUMENT", "PROCESS", "CIVIL", "GENERAL"]
elec_subs = ["SUGAR_ELECTRICAL", "COGEN_ELECTRICAL", "DIST_ELECTRICAL", "CBG_ELECTRICAL"]

# 2. Define specific areas that need the 550 Excel sheets each
# (Mill Electrical + 3 Boiling House Sections)
target_areas = ["MILL_ELECTRICAL", "JUICE_SECTION", "CENTRIFUGAL_SECTION", "REFINARY_SECTION"]

# 3. File counts per asset
asset_config = {
    "MOTORS": 250,
    "VFD": 150,
    "STARTERS": 150,
    "PANELS": 0  # Folder only
}

root = "Equipments_Maintenance"

print("Building hierarchy and generating 17,600 files... Please wait.")

for unit in units:
    for dept in depts:
        base_path = os.path.join(root, unit, dept)
        
        if dept == "ELECTRICAL":
            for sub in elec_subs:
                sub_path = os.path.join(base_path, sub)
                
                if sub == "SUGAR_ELECTRICAL":
                    # Define paths for Mill and Boiling House
                    mill_path = os.path.join(sub_path, "MILL_ELECTRICAL")
                    bh_path = os.path.join(sub_path, "BOILING_HOUSE_ELECTRICAL")
                    
                    # Create a list of all 4 folders that need files
                    active_folders = [
                        mill_path,
                        os.path.join(bh_path, "JUICE_SECTION"),
                        os.path.join(bh_path, "CENTRIFUGAL_SECTION"),
                        os.path.join(bh_path, "REFINARY_SECTION")
                    ]
                    
                    for folder in active_folders:
                        os.makedirs(folder, exist_ok=True)
                        folder_name = os.path.basename(folder)
                        
                        # Add the asset sub-folders and the Excel sheets
                        for asset, count in asset_config.items():
                            asset_dir = os.path.join(folder, asset)
                            os.makedirs(asset_dir, exist_ok=True)
                            
                            # Generate the requested number of Excel placeholders
                            for i in range(1, count + 1):
                                file_name = f"{folder_name}_{asset}_{i}.xlsx"
                                with open(os.path.join(asset_dir, file_name), 'w') as f:
                                    pass 
                else:
                    os.makedirs(sub_path, exist_ok=True)
        else:
            os.makedirs(base_path, exist_ok=True)

print(f"Successfully created structure in: {os.path.abspath(root)}")