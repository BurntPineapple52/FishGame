extends Node2D

var max_hp = 100
var hp = max_hp

var switch_treshold = 50
var switched = false

const head_zomb1 = preload("res://assets/sprites/player/fish_head_zombified1v2.png")
const body_zomb1 = preload("res://assets/sprites/player/fish_center_zombified1v2.png")
const tail_zomb1 = preload("res://assets/sprites/player/fish_tail_zombified1.png")

const head_zomb2 = preload("res://assets/sprites/player/fish_head_zombified2v5.png")
const body_zomb2 = preload("res://assets/sprites/player/fish_center_zombified2v2.png")
const tail_zomb2 = preload("res://assets/sprites/player/fish_tail_zombified2.png")

@onready var spr_head = $FishHead/Sprite2D
@onready var spr_body = $FishBody/Sprite2D
@onready var spr_tail = $FishTail/Sprite2D

@onready var damage_spr_head = $FishHead/Sprite2D/Sprite2D
@onready var damage_spr_body = $FishBody/Sprite2D/Sprite2D
@onready var damage_spr_tail = $FishTail/Sprite2D/Sprite2D

@onready var head_damage_flash = $FishHead/DamageFlash
@onready var body_damage_flash = $FishBody/DamageFlash
@onready var tail_damage_flash = $FishTail/DamageFlash

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	##debug
	#if(Input.is_action_just_pressed("ui_left")):
		#print("input damage trigger")
		#take_damage(5)
	#elif Input.is_action_just_pressed("ui_right"):
		#take_damage(30)
	pass
	
func take_damage(damage : float):
	hp -= damage
	var intensity = clamp(damage / 50 + .3,0,1)
	
	#tween to white, with varying intensity
	create_tween().tween_property(head_damage_flash,"self_modulate",Color(1,1,1,intensity),.1).set_ease(Tween.EASE_OUT)
	create_tween().tween_property(body_damage_flash,"self_modulate",Color(1,1,1,intensity),.1).set_ease(Tween.EASE_OUT)
	await create_tween().tween_property(tail_damage_flash,"self_modulate",Color(1,1,1,intensity),.1).set_ease(Tween.EASE_OUT).finished

	#if hp has crossed a threshold, start blending between zomb 1 and zomb 2 sprites (instead of between default and zomb 1
	if !switched and hp < switch_treshold:
		switched = true
		damage_spr_head.set_texture(head_zomb2)
		damage_spr_body.set_texture(body_zomb2)
		damage_spr_tail.set_texture(tail_zomb2)
		
		spr_head.set_texture(head_zomb1)
		spr_body.set_texture(body_zomb1)
		spr_tail.set_texture(tail_zomb1)
	
		#shifts alpha ratio to be from half max hp - max hp TO 0 to half max hp.
	var div = max_hp
	if switched:
		div = max_hp/2
	
	var alpha = 1- hp/div
	
	damage_spr_head.set_modulate(Color(damage_spr_head.get_modulate(),alpha))
	damage_spr_tail.set_modulate(Color(damage_spr_tail.get_modulate(),alpha))
	damage_spr_body.set_modulate(Color(damage_spr_body.get_modulate(),alpha))

		#tween away the damage flash
	create_tween().tween_property(head_damage_flash,"self_modulate",Color(1,1,1,0),.3).set_ease(Tween.EASE_IN)
	create_tween().tween_property(body_damage_flash,"self_modulate",Color(1,1,1,0),.3).set_ease(Tween.EASE_IN)
	await create_tween().tween_property(tail_damage_flash,"self_modulate",Color(1,1,1,0),.3).set_ease(Tween.EASE_IN).finished
