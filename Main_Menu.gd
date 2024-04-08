extends Node2D
@onready var game = $".."
@onready var camera_2d = $Camera2D
@onready var transitioner = $"../Transitioner"
var start_pos

func _ready():
	start_pos = camera_2d.position
	transitioner.color = Color(0,0,0,0)
	transitioner.position = start_pos
	pass

func _input(event):
	if Input.is_key_pressed(KEY_F) and Input.is_key_pressed(KEY_L) and Input.is_key_pressed(KEY_O) and Input.is_key_pressed(KEY_P):
		get_tree().create_tween().tween_property(camera_2d,"position",start_pos+Vector2(300,0),3).set_ease(Tween.EASE_IN)
		#await get_tree().create_tween().tween_property(color_rect,"color",Color(0,0,0,1),2).set_ease(Tween.EASE_OUT).finished
		#await get_tree().create_timer(1.5)
		##await get_tree().get_root().create_tween().tween_property(color_rect,"modulate",Color(0,0,0,1),2).set_ease(Tween.EASE_OUT).finished
		#get_tree().change_scene_to_file("res://scenes/stages/bear_stage.tscn") #"res://scenes/stages/glitch_testing.tscn")
		pass
	


	#player over edge
func _on_area_2d_body_entered(body):
	get_tree().create_tween().tween_property(camera_2d,"position",camera_2d.position+Vector2(2000,2000),1).set_ease(Tween.EASE_OUT)
	await get_tree().create_tween().tween_property(transitioner,"color",Color(0,0,0,1),1).set_ease(Tween.EASE_IN).finished
	get_tree().create_tween().tween_property(transitioner,"color",Color(0,0,0,0),1).set_ease(Tween.EASE_OUT).finished
	game.next_stage()
	process_mode=Node.PROCESS_MODE_DISABLED
