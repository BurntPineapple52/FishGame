extends Node2D


func _input(event):
	if Input.is_key_pressed(KEY_F) and Input.is_key_pressed(KEY_L) and Input.is_key_pressed(KEY_O) and Input.is_key_pressed(KEY_P):
		get_tree().change_scene_to_file("res://scenes/stages/bear_stage.tscn") #"res://scenes/stages/glitch_testing.tscn")
	
	
	
