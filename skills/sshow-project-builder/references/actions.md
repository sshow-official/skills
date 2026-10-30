<!-- GENERATED from the engine bundle — do not edit by hand.
     Engine bundle 1c053c4b · extracted 2026-10-30.
     Regenerate: node skills/sshow-project-builder/scripts/sync-engine.mjs [--bundle <path-or-url>] -->

# Action schema (`apply_actions`)

The machine contract for the action document: every op and the exact
parameter shape the engine accepts. Values, units, and recipes live in
[guide.md](guide.md).

## Ops (25)

- `create_object`
- `update_object`
- `delete_object`
- `duplicate_object`
- `move_object`
- `group_objects`
- `ungroup`
- `convert_to_path`
- `insert_table_rows`
- `insert_table_columns`
- `delete_table_rows`
- `delete_table_columns`
- `merge_table_cells`
- `unmerge_table_cells`
- `create_scene`
- `update_scene`
- `delete_scene`
- `duplicate_scene`
- `move_scene`
- `set_scene_size`
- `create_variable`
- `update_variable`
- `delete_variable`
- `move_variable`
- `set_document`

## Schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "actions"
  ],
  "properties": {
    "actions": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": true,
        "required": [
          "op"
        ],
        "properties": {
          "op": {
            "type": "string",
            "enum": [
              "create_object",
              "update_object",
              "delete_object",
              "duplicate_object",
              "move_object",
              "group_objects",
              "ungroup",
              "convert_to_path",
              "insert_table_rows",
              "insert_table_columns",
              "delete_table_rows",
              "delete_table_columns",
              "merge_table_cells",
              "unmerge_table_cells",
              "create_scene",
              "update_scene",
              "delete_scene",
              "duplicate_scene",
              "move_scene",
              "set_scene_size",
              "create_variable",
              "update_variable",
              "delete_variable",
              "move_variable",
              "set_document"
            ],
            "description": "The mutation to perform."
          },
          "sceneId": {
            "type": "string",
            "description": "Target scene id — object ops, update_scene, delete/duplicate/move scene. Use ids from the provided state."
          },
          "id": {
            "type": "string",
            "description": "Target object id — update_object, delete_object, duplicate_object, move_object, ungroup, convert_to_path; the table, for the table ops."
          },
          "ids": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Object ids to group together (group_objects)."
          },
          "type": {
            "type": "string",
            "enum": [
              "rect",
              "circle",
              "path",
              "text",
              "image",
              "video",
              "audio",
              "stream",
              "group",
              "frame",
              "table"
            ],
            "description": "Primitive type (create_object)."
          },
          "config": {
            "type": "object",
            "additionalProperties": true,
            "description": "Full config for create_object (and create_scene: name + size). Fill name, size, transform, style, and type-specific data.",
            "properties": {
              "id": {
                "type": "string",
                "description": "OPTIONAL alias for this NEW object (e.g. \"n1\"), valid only inside this request — set it ONLY to reference the object from a LATER action here. The engine assigns the real id; the alias must not clash with an id already in state."
              },
              "name": {
                "type": "string"
              },
              "size": {
                "type": "object",
                "properties": {
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  }
                }
              },
              "transform": {
                "type": "object",
                "properties": {
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "z": {
                    "type": "number",
                    "description": "depth px (+toward viewer), needs perspective"
                  },
                  "anchorX": {
                    "type": "number",
                    "description": "0=left,0.5=center,1=right of x. Match textAlign for text."
                  },
                  "anchorY": {
                    "type": "number",
                    "description": "0=top,0.5=middle,1=bottom of y."
                  },
                  "rotateX": {
                    "type": "number",
                    "description": "degrees (3D tilt)"
                  },
                  "rotateY": {
                    "type": "number",
                    "description": "degrees (3D tilt)"
                  },
                  "rotateZ": {
                    "type": "number",
                    "description": "degrees (2D spin)"
                  },
                  "scaleX": {
                    "type": "number"
                  },
                  "scaleY": {
                    "type": "number"
                  },
                  "perspective": {
                    "type": "number",
                    "description": "px distance, 0=flat"
                  }
                }
              },
              "opacity": {
                "type": "number",
                "description": "0..1"
              },
              "style": {
                "type": "object",
                "description": "fills = interior, strokes = outline, effects = shadow/blur/glow. Send all three arrays (use [] for none).",
                "properties": {
                  "fills": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "description": "Solid uses `color`; gradients use `colors` stops (+ geometry); image uses `src`; dynamic uses `source` + `name` + `params` (installed only — see dynamics in state). Geometry coords are 0..1 of the object's bounds.",
                      "properties": {
                        "type": {
                          "type": "string",
                          "enum": [
                            "solid",
                            "linearGradient",
                            "radialGradient",
                            "angularGradient",
                            "diamondGradient",
                            "image",
                            "dynamic"
                          ],
                          "description": "'solid' (default), a gradient, 'image', or 'dynamic'"
                        },
                        "color": {
                          "type": "string",
                          "description": "hex, e.g. #FF3889 (solid)"
                        },
                        "src": {
                          "type": "string",
                          "description": "image fill: 'asset://id' of an EXISTING project asset (new assets cannot be minted)"
                        },
                        "source": {
                          "type": "string",
                          "description": "dynamic: id of the pack it comes from"
                        },
                        "name": {
                          "type": "string",
                          "description": "dynamic: its name inside the pack"
                        },
                        "params": {
                          "type": "object",
                          "description": "dynamic: param values by key — defaults fill the rest"
                        },
                        "colors": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "offset": {
                                "type": "number",
                                "description": "0..1 position along the gradient"
                              },
                              "color": {
                                "type": "string",
                                "description": "hex"
                              },
                              "alpha": {
                                "type": "number",
                                "description": "0..1 (default 1)"
                              }
                            }
                          },
                          "description": "gradient stops, >=2 (gradients only)"
                        },
                        "start": {
                          "type": "object",
                          "properties": {
                            "x": {
                              "type": "number"
                            },
                            "y": {
                              "type": "number"
                            }
                          },
                          "description": "linearGradient start 0..1 (default {0,0})"
                        },
                        "end": {
                          "type": "object",
                          "properties": {
                            "x": {
                              "type": "number"
                            },
                            "y": {
                              "type": "number"
                            }
                          },
                          "description": "linearGradient end 0..1 (default {1,1})"
                        },
                        "center": {
                          "type": "object",
                          "properties": {
                            "x": {
                              "type": "number"
                            },
                            "y": {
                              "type": "number"
                            }
                          },
                          "description": "radial/angular/diamond center 0..1 (default {0.5,0.5})"
                        },
                        "opacity": {
                          "type": "number",
                          "description": "0..1"
                        },
                        "visible": {
                          "type": "boolean"
                        },
                        "width": {
                          "type": "number",
                          "description": "stroke width (strokes only)"
                        },
                        "align": {
                          "type": "number",
                          "description": "stroke align 0..1 (strokes only)"
                        }
                      }
                    }
                  },
                  "strokes": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "description": "Solid uses `color`; gradients use `colors` stops (+ geometry); image uses `src`; dynamic uses `source` + `name` + `params` (installed only — see dynamics in state). Geometry coords are 0..1 of the object's bounds.",
                      "properties": {
                        "type": {
                          "type": "string",
                          "enum": [
                            "solid",
                            "linearGradient",
                            "radialGradient",
                            "angularGradient",
                            "diamondGradient",
                            "image",
                            "dynamic"
                          ],
                          "description": "'solid' (default), a gradient, 'image', or 'dynamic'"
                        },
                        "color": {
                          "type": "string",
                          "description": "hex, e.g. #FF3889 (solid)"
                        },
                        "src": {
                          "type": "string",
                          "description": "image fill: 'asset://id' of an EXISTING project asset (new assets cannot be minted)"
                        },
                        "source": {
                          "type": "string",
                          "description": "dynamic: id of the pack it comes from"
                        },
                        "name": {
                          "type": "string",
                          "description": "dynamic: its name inside the pack"
                        },
                        "params": {
                          "type": "object",
                          "description": "dynamic: param values by key — defaults fill the rest"
                        },
                        "colors": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "offset": {
                                "type": "number",
                                "description": "0..1 position along the gradient"
                              },
                              "color": {
                                "type": "string",
                                "description": "hex"
                              },
                              "alpha": {
                                "type": "number",
                                "description": "0..1 (default 1)"
                              }
                            }
                          },
                          "description": "gradient stops, >=2 (gradients only)"
                        },
                        "start": {
                          "type": "object",
                          "properties": {
                            "x": {
                              "type": "number"
                            },
                            "y": {
                              "type": "number"
                            }
                          },
                          "description": "linearGradient start 0..1 (default {0,0})"
                        },
                        "end": {
                          "type": "object",
                          "properties": {
                            "x": {
                              "type": "number"
                            },
                            "y": {
                              "type": "number"
                            }
                          },
                          "description": "linearGradient end 0..1 (default {1,1})"
                        },
                        "center": {
                          "type": "object",
                          "properties": {
                            "x": {
                              "type": "number"
                            },
                            "y": {
                              "type": "number"
                            }
                          },
                          "description": "radial/angular/diamond center 0..1 (default {0.5,0.5})"
                        },
                        "opacity": {
                          "type": "number",
                          "description": "0..1"
                        },
                        "visible": {
                          "type": "boolean"
                        },
                        "width": {
                          "type": "number",
                          "description": "stroke width (strokes only)"
                        },
                        "align": {
                          "type": "number",
                          "description": "stroke align 0..1 (strokes only)"
                        }
                      }
                    }
                  },
                  "effects": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "additionalProperties": true,
                      "description": "shadow/glow use color+alpha (+offset/blur); blur uses strength (+progressive start/end); glass uses refraction/chromaticAberration (the first solid fill tints it); adjustment uses -100..100 scalars (0 = unchanged; sharpen/vignette 0..100; invert 0 or 100 (100 = inverted)) + hue in degrees (colorBalance/blackAndWhite when asked). dynamic uses source/name/params like a dynamic fill, opacity = how much of its result shows over the object (0..1).",
                      "properties": {
                        "type": {
                          "type": "string",
                          "enum": [
                            "blur",
                            "backdropBlur",
                            "dropShadow",
                            "innerShadow",
                            "outerGlow",
                            "glass",
                            "noise",
                            "adjustment",
                            "dynamic"
                          ],
                          "description": "effect kind"
                        },
                        "strength": {
                          "type": "number",
                          "description": "blur/backdropBlur radius (default 8)"
                        },
                        "startX": {
                          "type": "number",
                          "description": "progressive blur axis start 0..1 (blur/backdropBlur)"
                        },
                        "startY": {
                          "type": "number",
                          "description": "progressive blur axis start 0..1"
                        },
                        "endX": {
                          "type": "number",
                          "description": "progressive blur axis end 0..1"
                        },
                        "endY": {
                          "type": "number",
                          "description": "progressive blur axis end 0..1"
                        },
                        "startStrength": {
                          "type": "number",
                          "description": "blur multiplier at axis start (1=full). 1/1 = uniform."
                        },
                        "endStrength": {
                          "type": "number",
                          "description": "blur multiplier at axis end (1=full)"
                        },
                        "offsetX": {
                          "type": "number",
                          "description": "drop/innerShadow"
                        },
                        "offsetY": {
                          "type": "number",
                          "description": "drop/innerShadow"
                        },
                        "blur": {
                          "type": "number",
                          "description": "shadow/glow/glass blur radius"
                        },
                        "spread": {
                          "type": "number",
                          "description": "shadow/glow"
                        },
                        "color": {
                          "type": "string",
                          "description": "shadow/glow hex"
                        },
                        "alpha": {
                          "type": "number",
                          "description": "shadow/glow 0..1"
                        },
                        "intensity": {
                          "type": "number",
                          "description": "outerGlow"
                        },
                        "amount": {
                          "type": "number",
                          "description": "noise 0..1"
                        },
                        "brightness": {
                          "type": "number",
                          "description": "adjustment -100..100 (0 = unchanged), moves midtones, black/white stay"
                        },
                        "contrast": {
                          "type": "number",
                          "description": "adjustment -100..100, S curve (no clipping)"
                        },
                        "saturation": {
                          "type": "number",
                          "description": "adjustment -100..100"
                        },
                        "hue": {
                          "type": "number",
                          "description": "adjustment hue shift -180..180 degrees"
                        },
                        "exposure": {
                          "type": "number",
                          "description": "adjustment exposure -100..100 (±100 = ±2 EV)"
                        },
                        "temperature": {
                          "type": "number",
                          "description": "adjustment warm(+)/cool(-) -100..100"
                        },
                        "tint": {
                          "type": "number",
                          "description": "adjustment magenta(+)/green(-) -100..100 (blackAndWhite.tint is a hex; glass ignores tint)"
                        },
                        "vibrance": {
                          "type": "number",
                          "description": "adjustment -100..100, protects skin tones"
                        },
                        "highlights": {
                          "type": "number",
                          "description": "adjustment bright-area tone -100..100 (not colorBalance.highlights)"
                        },
                        "shadows": {
                          "type": "number",
                          "description": "adjustment dark-area tone -100..100 (not colorBalance.shadows)"
                        },
                        "whites": {
                          "type": "number",
                          "description": "adjustment brighter(+)/dimmer(-) whites -100..100"
                        },
                        "blacks": {
                          "type": "number",
                          "description": "adjustment lifted(+)/deeper(-) blacks -100..100"
                        },
                        "clarity": {
                          "type": "number",
                          "description": "adjustment local contrast -100..100"
                        },
                        "sharpen": {
                          "type": "number",
                          "description": "adjustment 0..100"
                        },
                        "vignette": {
                          "type": "number",
                          "description": "adjustment edge darkening 0..100"
                        },
                        "invert": {
                          "type": "number",
                          "description": "adjustment 0 or 100 (100 = inverted)"
                        },
                        "levels": {
                          "type": "object",
                          "description": "adjustment {rgb|r|g|b:{input:{black 0..254,gamma 0.1..9.99,white 1..255},output:{black,white 0..255}}}; send every channel you keep (a missing one is identity)"
                        },
                        "curves": {
                          "type": "object",
                          "description": "adjustment {rgb|r|g|b:[[x,y]…]} 0..255, x ascending, ends included; send every channel you keep"
                        },
                        "refraction": {
                          "type": "number",
                          "description": "glass 0..2"
                        },
                        "chromaticAberration": {
                          "type": "number",
                          "description": "glass 0..2"
                        },
                        "scale": {
                          "type": "number",
                          "description": "noise grain scale"
                        },
                        "monochrome": {
                          "type": "boolean",
                          "description": "noise"
                        },
                        "seed": {
                          "type": "number",
                          "description": "noise"
                        },
                        "opacity": {
                          "type": "number",
                          "description": "dynamic: 0..1"
                        },
                        "visible": {
                          "type": "boolean"
                        }
                      }
                    }
                  }
                }
              },
              "layout": {
                "type": "object",
                "description": "pin: re-derive position/size when the pin parent (frame for children, canvas for top-level) RESIZES. set.layout MERGES per axis.",
                "properties": {
                  "pin": {
                    "type": "object",
                    "properties": {
                      "horizontal": {
                        "type": "string",
                        "enum": [
                          "left",
                          "right",
                          "center",
                          "stretch",
                          "scale"
                        ],
                        "description": "default left"
                      },
                      "vertical": {
                        "type": "string",
                        "enum": [
                          "top",
                          "bottom",
                          "center",
                          "stretch",
                          "scale"
                        ],
                        "description": "default top"
                      }
                    }
                  }
                }
              },
              "distort": {
                "type": "object",
                "description": "perspective distort. corners in TL,TR,BR,BL order, each 0..1 of the object's size (identity {0,0},{1,0},{1,1},{0,1}).",
                "properties": {
                  "type": {
                    "type": "string",
                    "enum": [
                      "perspective"
                    ]
                  },
                  "visible": {
                    "type": "boolean"
                  },
                  "corners": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "x": {
                          "type": "number"
                        },
                        "y": {
                          "type": "number"
                        }
                      }
                    },
                    "description": "4 corners, TL,TR,BR,BL"
                  }
                }
              },
              "motion": {
                "type": "object",
                "description": "set.motion merges per sub-container: a sent `transitions`/`animations` map REPLACES that map wholesale, the omitted one is preserved.",
                "properties": {
                  "transitions": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "object",
                      "description": "A transition tween. easing OR spring; omit = snap.",
                      "properties": {
                        "type": {
                          "type": "string",
                          "enum": [
                            "easing",
                            "spring"
                          ]
                        },
                        "delay": {
                          "type": "number",
                          "description": "ms before start (use for stagger)"
                        },
                        "easing": {
                          "type": "object",
                          "properties": {
                            "duration": {
                              "type": "number",
                              "description": "ms"
                            },
                            "curve": {
                              "type": "array",
                              "items": {
                                "type": "number"
                              },
                              "description": "cubic-bezier [x1,y1,x2,y2]"
                            }
                          }
                        },
                        "spring": {
                          "type": "object",
                          "properties": {
                            "stiffness": {
                              "type": "number"
                            },
                            "damping": {
                              "type": "number"
                            },
                            "mass": {
                              "type": "number"
                            }
                          }
                        }
                      }
                    },
                    "description": "Scene-navigation tween per key. Scene keys: 'default','style'. Object keys: 'default','style','opacity','transform','transform.x|.y|.z|.rotateX|.rotateY|.rotateZ|.scaleX|.scaleY|.skewX|.skewY|.anchorX|.anchorY|.perspective','size','size.width|.height'. distort/path/radius morph ride the 'style' tween. See guide §8."
                  },
                  "animations": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "object",
                      "description": "Scene 'default' = the timeline clock {duration, fps?, stops?, keyframes?}; object 'default' = {keyframes} riding it; a frame's NAMED entry with a duration = the frame's own clock. Track keys and units: guide §10.",
                      "properties": {
                        "duration": {
                          "type": "number",
                          "description": "clock length ms (scene declaration; default 5000)"
                        },
                        "fps": {
                          "type": "number",
                          "description": "optional frame-grid sampling (e.g. 12); omit = smooth"
                        },
                        "stops": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "string",
                                "description": "self-assigned, e.g. 's1'"
                              },
                              "time": {
                                "type": "number"
                              },
                              "label": {
                                "type": "string"
                              }
                            }
                          },
                          "description": "clicker stop points — playback pauses at each"
                        },
                        "workArea": {
                          "type": "object",
                          "properties": {
                            "start": {
                              "type": "number"
                            },
                            "end": {
                              "type": "number"
                            }
                          },
                          "description": "optional play span ms (AE work area) — play mode runs only this slice of the clock; the editor previews the whole clock"
                        },
                        "state": {
                          "type": "object",
                          "properties": {
                            "initial": {
                              "type": "boolean"
                            }
                          },
                          "description": "frame clock only: a STATE — {} or {initial:true} (the resting one); entered by setState (§13)"
                        },
                        "autoplay": {
                          "type": "boolean",
                          "description": "named clock only (not a state): starts on scene entry; one per frame"
                        },
                        "loop": {
                          "type": "boolean",
                          "description": "named clock only (not a state): restarts at its end"
                        },
                        "keyframes": {
                          "type": "object",
                          "additionalProperties": {
                            "type": "array",
                            "items": {
                              "type": "object",
                              "properties": {
                                "time": {
                                  "type": "number",
                                  "description": "ms on the scene clock"
                                },
                                "value": {
                                  "description": "ENGINE units: x/y/size px, transform.rotate* RADIANS, opacity 0..1; string for data.text; style object for 'style'; one paint/effect for 'style.fills.N' etc."
                                },
                                "tween": {
                                  "type": "object",
                                  "description": "Tween toward the NEXT key. 'step' holds then jumps (appear/disappear). Omit = default ease.",
                                  "properties": {
                                    "type": {
                                      "type": "string",
                                      "enum": [
                                        "easing",
                                        "spring",
                                        "step"
                                      ]
                                    },
                                    "easing": {
                                      "type": "object",
                                      "properties": {
                                        "curve": {
                                          "type": "array",
                                          "items": {
                                            "type": "number"
                                          },
                                          "description": "cubic-bezier [x1,y1,x2,y2]"
                                        }
                                      }
                                    },
                                    "spring": {
                                      "type": "object",
                                      "properties": {
                                        "stiffness": {
                                          "type": "number"
                                        },
                                        "damping": {
                                          "type": "number"
                                        },
                                        "mass": {
                                          "type": "number"
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          },
                          "description": "track key → keyframes (time ascending)"
                        }
                      }
                    },
                    "description": "name → animation; use 'default' (the presentation timeline). See guide §10."
                  }
                }
              },
              "data": {
                "type": "object",
                "description": "text→text/fontFamily/fontSize/fontWeight/textAlign/verticalAlign/autoSize; rect→radius; circle→innerRadius; image/video/audio→src; stream→source/poster (guide §4.8); path→points/closed and a connector's ends and route (guide §4.3); table→its texts, tracks and looks (guide §14).",
                "properties": {
                  "text": {
                    "type": "string"
                  },
                  "fontFamily": {
                    "type": "string",
                    "description": "e.g. 'Pretendard'"
                  },
                  "fontSize": {
                    "type": "number"
                  },
                  "fontWeight": {
                    "type": "number",
                    "description": "400/500/700"
                  },
                  "textAlign": {
                    "type": "string",
                    "enum": [
                      "left",
                      "center",
                      "right"
                    ]
                  },
                  "verticalAlign": {
                    "type": "string",
                    "enum": [
                      "top",
                      "middle",
                      "bottom"
                    ]
                  },
                  "autoSize": {
                    "type": "boolean",
                    "description": "true = text grows to its content (titles/labels, no wrap). false = WRAP inside a fixed box — REQUIRED for body/paragraph text in a card/panel; set size.width to the container inner width or it overflows into neighbors."
                  },
                  "lineHeight": {
                    "type": "number"
                  },
                  "letterSpacing": {
                    "type": "number"
                  },
                  "radius": {
                    "type": "array",
                    "items": {
                      "type": "number"
                    },
                    "description": "rect/frame/table/stream [tl,tr,br,bl]"
                  },
                  "clip": {
                    "type": "boolean",
                    "description": "frame/table: clip children to the bounds (default true)"
                  },
                  "values": {
                    "type": "array",
                    "items": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "description": "table: cell texts by row; null keeps a cell"
                  },
                  "columns": {
                    "type": "array",
                    "items": {
                      "type": "object"
                    },
                    "description": "table: [{id, width}] — by id (a create: in order, no id)"
                  },
                  "rows": {
                    "type": "array",
                    "items": {
                      "type": "object"
                    },
                    "description": "table: [{id, height}] least heights — by id (a create: in order, no id)"
                  },
                  "cells": {
                    "type": "object",
                    "description": "table: 'rowId:colId' → {fill, borders:{top,right,bottom,left}, padding}; null = the table's look"
                  },
                  "lines": {
                    "type": "object",
                    "description": "table: inner lines {horizontal, vertical}"
                  },
                  "headerRows": {
                    "type": "object",
                    "description": "table: {count, fill} the top rows"
                  },
                  "bandRows": {
                    "type": "object",
                    "description": "table: {fill} every other body row"
                  },
                  "padding": {
                    "type": "array",
                    "items": {
                      "type": "number"
                    },
                    "description": "table: cell padding [t,r,b,l]"
                  },
                  "innerRadius": {
                    "type": "number",
                    "description": "circle (0 = disc)"
                  },
                  "src": {
                    "type": "string",
                    "description": "image/video/audio asset uri"
                  },
                  "source": {
                    "type": "object",
                    "properties": {
                      "kind": {
                        "type": "string",
                        "enum": [
                          "camera",
                          "screen"
                        ]
                      },
                      "id": {
                        "type": "string",
                        "description": "an existing source's id to show the same camera again; omit for a new one"
                      }
                    },
                    "description": "stream: its live source"
                  },
                  "fit": {
                    "type": "string",
                    "enum": [
                      "cover",
                      "contain"
                    ],
                    "description": "stream"
                  },
                  "mirror": {
                    "type": "boolean",
                    "description": "stream: flip (front camera)"
                  },
                  "muted": {
                    "type": "boolean",
                    "description": "video/stream"
                  },
                  "volume": {
                    "type": "number",
                    "description": "video/stream 0..1"
                  },
                  "poster": {
                    "type": "string",
                    "description": "stream: image asset uri"
                  },
                  "closed": {
                    "type": "boolean",
                    "description": "path"
                  },
                  "connectionStart": {
                    "type": "object",
                    "description": "connector end, whole; null detaches",
                    "properties": {
                      "objectId": {
                        "type": "string"
                      },
                      "position": {
                        "type": "object",
                        "properties": {
                          "x": {
                            "type": "number"
                          },
                          "y": {
                            "type": "number"
                          }
                        }
                      }
                    }
                  },
                  "connectionEnd": {
                    "type": "object",
                    "description": "connector end, whole; null detaches",
                    "properties": {
                      "objectId": {
                        "type": "string"
                      },
                      "position": {
                        "type": "object",
                        "properties": {
                          "x": {
                            "type": "number"
                          },
                          "y": {
                            "type": "number"
                          }
                        }
                      }
                    }
                  },
                  "connectionRoute": {
                    "type": "string",
                    "enum": [
                      "free",
                      "straight",
                      "curve",
                      "elbow"
                    ]
                  },
                  "connectionAvoid": {
                    "type": "boolean",
                    "description": "curve/elbow only"
                  },
                  "points": {
                    "type": "array",
                    "description": "path geometry; each point { type:\"move\"|\"line\"|\"quadratic\"|\"cubic\"|\"close\", x, y } — quadratic adds cx, cy; cubic adds cx1, cy1, cx2, cy2",
                    "items": {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "enum": [
                            "move",
                            "line",
                            "quadratic",
                            "cubic",
                            "close"
                          ]
                        },
                        "x": {
                          "type": "number"
                        },
                        "y": {
                          "type": "number"
                        },
                        "cx": {
                          "type": "number"
                        },
                        "cy": {
                          "type": "number"
                        },
                        "cx1": {
                          "type": "number"
                        },
                        "cy1": {
                          "type": "number"
                        },
                        "cx2": {
                          "type": "number"
                        },
                        "cy2": {
                          "type": "number"
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "set": {
            "type": "object",
            "additionalProperties": true,
            "description": "transform/size/data/layout MERGE (send only changed keys); style/distort REPLACE wholesale.",
            "properties": {
              "name": {
                "type": "string"
              },
              "opacity": {
                "type": "number"
              },
              "visible": {
                "type": "boolean"
              },
              "locked": {
                "type": "boolean"
              },
              "blendMode": {
                "type": "string"
              },
              "style": {
                "type": "object",
                "description": "fills = interior, strokes = outline, effects = shadow/blur/glow. Send all three arrays (use [] for none).",
                "properties": {
                  "fills": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "description": "Solid uses `color`; gradients use `colors` stops (+ geometry); image uses `src`; dynamic uses `source` + `name` + `params` (installed only — see dynamics in state). Geometry coords are 0..1 of the object's bounds.",
                      "properties": {
                        "type": {
                          "type": "string",
                          "enum": [
                            "solid",
                            "linearGradient",
                            "radialGradient",
                            "angularGradient",
                            "diamondGradient",
                            "image",
                            "dynamic"
                          ],
                          "description": "'solid' (default), a gradient, 'image', or 'dynamic'"
                        },
                        "color": {
                          "type": "string",
                          "description": "hex, e.g. #FF3889 (solid)"
                        },
                        "src": {
                          "type": "string",
                          "description": "image fill: 'asset://id' of an EXISTING project asset (new assets cannot be minted)"
                        },
                        "source": {
                          "type": "string",
                          "description": "dynamic: id of the pack it comes from"
                        },
                        "name": {
                          "type": "string",
                          "description": "dynamic: its name inside the pack"
                        },
                        "params": {
                          "type": "object",
                          "description": "dynamic: param values by key — defaults fill the rest"
                        },
                        "colors": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "offset": {
                                "type": "number",
                                "description": "0..1 position along the gradient"
                              },
                              "color": {
                                "type": "string",
                                "description": "hex"
                              },
                              "alpha": {
                                "type": "number",
                                "description": "0..1 (default 1)"
                              }
                            }
                          },
                          "description": "gradient stops, >=2 (gradients only)"
                        },
                        "start": {
                          "type": "object",
                          "properties": {
                            "x": {
                              "type": "number"
                            },
                            "y": {
                              "type": "number"
                            }
                          },
                          "description": "linearGradient start 0..1 (default {0,0})"
                        },
                        "end": {
                          "type": "object",
                          "properties": {
                            "x": {
                              "type": "number"
                            },
                            "y": {
                              "type": "number"
                            }
                          },
                          "description": "linearGradient end 0..1 (default {1,1})"
                        },
                        "center": {
                          "type": "object",
                          "properties": {
                            "x": {
                              "type": "number"
                            },
                            "y": {
                              "type": "number"
                            }
                          },
                          "description": "radial/angular/diamond center 0..1 (default {0.5,0.5})"
                        },
                        "opacity": {
                          "type": "number",
                          "description": "0..1"
                        },
                        "visible": {
                          "type": "boolean"
                        },
                        "width": {
                          "type": "number",
                          "description": "stroke width (strokes only)"
                        },
                        "align": {
                          "type": "number",
                          "description": "stroke align 0..1 (strokes only)"
                        }
                      }
                    }
                  },
                  "strokes": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "description": "Solid uses `color`; gradients use `colors` stops (+ geometry); image uses `src`; dynamic uses `source` + `name` + `params` (installed only — see dynamics in state). Geometry coords are 0..1 of the object's bounds.",
                      "properties": {
                        "type": {
                          "type": "string",
                          "enum": [
                            "solid",
                            "linearGradient",
                            "radialGradient",
                            "angularGradient",
                            "diamondGradient",
                            "image",
                            "dynamic"
                          ],
                          "description": "'solid' (default), a gradient, 'image', or 'dynamic'"
                        },
                        "color": {
                          "type": "string",
                          "description": "hex, e.g. #FF3889 (solid)"
                        },
                        "src": {
                          "type": "string",
                          "description": "image fill: 'asset://id' of an EXISTING project asset (new assets cannot be minted)"
                        },
                        "source": {
                          "type": "string",
                          "description": "dynamic: id of the pack it comes from"
                        },
                        "name": {
                          "type": "string",
                          "description": "dynamic: its name inside the pack"
                        },
                        "params": {
                          "type": "object",
                          "description": "dynamic: param values by key — defaults fill the rest"
                        },
                        "colors": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "offset": {
                                "type": "number",
                                "description": "0..1 position along the gradient"
                              },
                              "color": {
                                "type": "string",
                                "description": "hex"
                              },
                              "alpha": {
                                "type": "number",
                                "description": "0..1 (default 1)"
                              }
                            }
                          },
                          "description": "gradient stops, >=2 (gradients only)"
                        },
                        "start": {
                          "type": "object",
                          "properties": {
                            "x": {
                              "type": "number"
                            },
                            "y": {
                              "type": "number"
                            }
                          },
                          "description": "linearGradient start 0..1 (default {0,0})"
                        },
                        "end": {
                          "type": "object",
                          "properties": {
                            "x": {
                              "type": "number"
                            },
                            "y": {
                              "type": "number"
                            }
                          },
                          "description": "linearGradient end 0..1 (default {1,1})"
                        },
                        "center": {
                          "type": "object",
                          "properties": {
                            "x": {
                              "type": "number"
                            },
                            "y": {
                              "type": "number"
                            }
                          },
                          "description": "radial/angular/diamond center 0..1 (default {0.5,0.5})"
                        },
                        "opacity": {
                          "type": "number",
                          "description": "0..1"
                        },
                        "visible": {
                          "type": "boolean"
                        },
                        "width": {
                          "type": "number",
                          "description": "stroke width (strokes only)"
                        },
                        "align": {
                          "type": "number",
                          "description": "stroke align 0..1 (strokes only)"
                        }
                      }
                    }
                  },
                  "effects": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "additionalProperties": true,
                      "description": "shadow/glow use color+alpha (+offset/blur); blur uses strength (+progressive start/end); glass uses refraction/chromaticAberration (the first solid fill tints it); adjustment uses -100..100 scalars (0 = unchanged; sharpen/vignette 0..100; invert 0 or 100 (100 = inverted)) + hue in degrees (colorBalance/blackAndWhite when asked). dynamic uses source/name/params like a dynamic fill, opacity = how much of its result shows over the object (0..1).",
                      "properties": {
                        "type": {
                          "type": "string",
                          "enum": [
                            "blur",
                            "backdropBlur",
                            "dropShadow",
                            "innerShadow",
                            "outerGlow",
                            "glass",
                            "noise",
                            "adjustment",
                            "dynamic"
                          ],
                          "description": "effect kind"
                        },
                        "strength": {
                          "type": "number",
                          "description": "blur/backdropBlur radius (default 8)"
                        },
                        "startX": {
                          "type": "number",
                          "description": "progressive blur axis start 0..1 (blur/backdropBlur)"
                        },
                        "startY": {
                          "type": "number",
                          "description": "progressive blur axis start 0..1"
                        },
                        "endX": {
                          "type": "number",
                          "description": "progressive blur axis end 0..1"
                        },
                        "endY": {
                          "type": "number",
                          "description": "progressive blur axis end 0..1"
                        },
                        "startStrength": {
                          "type": "number",
                          "description": "blur multiplier at axis start (1=full). 1/1 = uniform."
                        },
                        "endStrength": {
                          "type": "number",
                          "description": "blur multiplier at axis end (1=full)"
                        },
                        "offsetX": {
                          "type": "number",
                          "description": "drop/innerShadow"
                        },
                        "offsetY": {
                          "type": "number",
                          "description": "drop/innerShadow"
                        },
                        "blur": {
                          "type": "number",
                          "description": "shadow/glow/glass blur radius"
                        },
                        "spread": {
                          "type": "number",
                          "description": "shadow/glow"
                        },
                        "color": {
                          "type": "string",
                          "description": "shadow/glow hex"
                        },
                        "alpha": {
                          "type": "number",
                          "description": "shadow/glow 0..1"
                        },
                        "intensity": {
                          "type": "number",
                          "description": "outerGlow"
                        },
                        "amount": {
                          "type": "number",
                          "description": "noise 0..1"
                        },
                        "brightness": {
                          "type": "number",
                          "description": "adjustment -100..100 (0 = unchanged), moves midtones, black/white stay"
                        },
                        "contrast": {
                          "type": "number",
                          "description": "adjustment -100..100, S curve (no clipping)"
                        },
                        "saturation": {
                          "type": "number",
                          "description": "adjustment -100..100"
                        },
                        "hue": {
                          "type": "number",
                          "description": "adjustment hue shift -180..180 degrees"
                        },
                        "exposure": {
                          "type": "number",
                          "description": "adjustment exposure -100..100 (±100 = ±2 EV)"
                        },
                        "temperature": {
                          "type": "number",
                          "description": "adjustment warm(+)/cool(-) -100..100"
                        },
                        "tint": {
                          "type": "number",
                          "description": "adjustment magenta(+)/green(-) -100..100 (blackAndWhite.tint is a hex; glass ignores tint)"
                        },
                        "vibrance": {
                          "type": "number",
                          "description": "adjustment -100..100, protects skin tones"
                        },
                        "highlights": {
                          "type": "number",
                          "description": "adjustment bright-area tone -100..100 (not colorBalance.highlights)"
                        },
                        "shadows": {
                          "type": "number",
                          "description": "adjustment dark-area tone -100..100 (not colorBalance.shadows)"
                        },
                        "whites": {
                          "type": "number",
                          "description": "adjustment brighter(+)/dimmer(-) whites -100..100"
                        },
                        "blacks": {
                          "type": "number",
                          "description": "adjustment lifted(+)/deeper(-) blacks -100..100"
                        },
                        "clarity": {
                          "type": "number",
                          "description": "adjustment local contrast -100..100"
                        },
                        "sharpen": {
                          "type": "number",
                          "description": "adjustment 0..100"
                        },
                        "vignette": {
                          "type": "number",
                          "description": "adjustment edge darkening 0..100"
                        },
                        "invert": {
                          "type": "number",
                          "description": "adjustment 0 or 100 (100 = inverted)"
                        },
                        "levels": {
                          "type": "object",
                          "description": "adjustment {rgb|r|g|b:{input:{black 0..254,gamma 0.1..9.99,white 1..255},output:{black,white 0..255}}}; send every channel you keep (a missing one is identity)"
                        },
                        "curves": {
                          "type": "object",
                          "description": "adjustment {rgb|r|g|b:[[x,y]…]} 0..255, x ascending, ends included; send every channel you keep"
                        },
                        "refraction": {
                          "type": "number",
                          "description": "glass 0..2"
                        },
                        "chromaticAberration": {
                          "type": "number",
                          "description": "glass 0..2"
                        },
                        "scale": {
                          "type": "number",
                          "description": "noise grain scale"
                        },
                        "monochrome": {
                          "type": "boolean",
                          "description": "noise"
                        },
                        "seed": {
                          "type": "number",
                          "description": "noise"
                        },
                        "opacity": {
                          "type": "number",
                          "description": "dynamic: 0..1"
                        },
                        "visible": {
                          "type": "boolean"
                        }
                      }
                    }
                  }
                }
              },
              "transform": {
                "type": "object",
                "properties": {
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "z": {
                    "type": "number",
                    "description": "depth px (+toward viewer), needs perspective"
                  },
                  "anchorX": {
                    "type": "number",
                    "description": "0=left,0.5=center,1=right of x. Match textAlign for text."
                  },
                  "anchorY": {
                    "type": "number",
                    "description": "0=top,0.5=middle,1=bottom of y."
                  },
                  "rotateX": {
                    "type": "number",
                    "description": "degrees (3D tilt)"
                  },
                  "rotateY": {
                    "type": "number",
                    "description": "degrees (3D tilt)"
                  },
                  "rotateZ": {
                    "type": "number",
                    "description": "degrees (2D spin)"
                  },
                  "scaleX": {
                    "type": "number"
                  },
                  "scaleY": {
                    "type": "number"
                  },
                  "perspective": {
                    "type": "number",
                    "description": "px distance, 0=flat"
                  }
                }
              },
              "size": {
                "type": "object",
                "properties": {
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  }
                }
              },
              "layout": {
                "type": "object",
                "description": "pin: re-derive position/size when the pin parent (frame for children, canvas for top-level) RESIZES. set.layout MERGES per axis.",
                "properties": {
                  "pin": {
                    "type": "object",
                    "properties": {
                      "horizontal": {
                        "type": "string",
                        "enum": [
                          "left",
                          "right",
                          "center",
                          "stretch",
                          "scale"
                        ],
                        "description": "default left"
                      },
                      "vertical": {
                        "type": "string",
                        "enum": [
                          "top",
                          "bottom",
                          "center",
                          "stretch",
                          "scale"
                        ],
                        "description": "default top"
                      }
                    }
                  }
                }
              },
              "distort": {
                "type": "object",
                "description": "perspective distort. corners in TL,TR,BR,BL order, each 0..1 of the object's size (identity {0,0},{1,0},{1,1},{0,1}).",
                "properties": {
                  "type": {
                    "type": "string",
                    "enum": [
                      "perspective"
                    ]
                  },
                  "visible": {
                    "type": "boolean"
                  },
                  "corners": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "x": {
                          "type": "number"
                        },
                        "y": {
                          "type": "number"
                        }
                      }
                    },
                    "description": "4 corners, TL,TR,BR,BL"
                  }
                }
              },
              "motion": {
                "type": "object",
                "description": "set.motion merges per sub-container: a sent `transitions`/`animations` map REPLACES that map wholesale, the omitted one is preserved.",
                "properties": {
                  "transitions": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "object",
                      "description": "A transition tween. easing OR spring; omit = snap.",
                      "properties": {
                        "type": {
                          "type": "string",
                          "enum": [
                            "easing",
                            "spring"
                          ]
                        },
                        "delay": {
                          "type": "number",
                          "description": "ms before start (use for stagger)"
                        },
                        "easing": {
                          "type": "object",
                          "properties": {
                            "duration": {
                              "type": "number",
                              "description": "ms"
                            },
                            "curve": {
                              "type": "array",
                              "items": {
                                "type": "number"
                              },
                              "description": "cubic-bezier [x1,y1,x2,y2]"
                            }
                          }
                        },
                        "spring": {
                          "type": "object",
                          "properties": {
                            "stiffness": {
                              "type": "number"
                            },
                            "damping": {
                              "type": "number"
                            },
                            "mass": {
                              "type": "number"
                            }
                          }
                        }
                      }
                    },
                    "description": "Scene-navigation tween per key. Scene keys: 'default','style'. Object keys: 'default','style','opacity','transform','transform.x|.y|.z|.rotateX|.rotateY|.rotateZ|.scaleX|.scaleY|.skewX|.skewY|.anchorX|.anchorY|.perspective','size','size.width|.height'. distort/path/radius morph ride the 'style' tween. See guide §8."
                  },
                  "animations": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "object",
                      "description": "Scene 'default' = the timeline clock {duration, fps?, stops?, keyframes?}; object 'default' = {keyframes} riding it; a frame's NAMED entry with a duration = the frame's own clock. Track keys and units: guide §10.",
                      "properties": {
                        "duration": {
                          "type": "number",
                          "description": "clock length ms (scene declaration; default 5000)"
                        },
                        "fps": {
                          "type": "number",
                          "description": "optional frame-grid sampling (e.g. 12); omit = smooth"
                        },
                        "stops": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "string",
                                "description": "self-assigned, e.g. 's1'"
                              },
                              "time": {
                                "type": "number"
                              },
                              "label": {
                                "type": "string"
                              }
                            }
                          },
                          "description": "clicker stop points — playback pauses at each"
                        },
                        "workArea": {
                          "type": "object",
                          "properties": {
                            "start": {
                              "type": "number"
                            },
                            "end": {
                              "type": "number"
                            }
                          },
                          "description": "optional play span ms (AE work area) — play mode runs only this slice of the clock; the editor previews the whole clock"
                        },
                        "state": {
                          "type": "object",
                          "properties": {
                            "initial": {
                              "type": "boolean"
                            }
                          },
                          "description": "frame clock only: a STATE — {} or {initial:true} (the resting one); entered by setState (§13)"
                        },
                        "autoplay": {
                          "type": "boolean",
                          "description": "named clock only (not a state): starts on scene entry; one per frame"
                        },
                        "loop": {
                          "type": "boolean",
                          "description": "named clock only (not a state): restarts at its end"
                        },
                        "keyframes": {
                          "type": "object",
                          "additionalProperties": {
                            "type": "array",
                            "items": {
                              "type": "object",
                              "properties": {
                                "time": {
                                  "type": "number",
                                  "description": "ms on the scene clock"
                                },
                                "value": {
                                  "description": "ENGINE units: x/y/size px, transform.rotate* RADIANS, opacity 0..1; string for data.text; style object for 'style'; one paint/effect for 'style.fills.N' etc."
                                },
                                "tween": {
                                  "type": "object",
                                  "description": "Tween toward the NEXT key. 'step' holds then jumps (appear/disappear). Omit = default ease.",
                                  "properties": {
                                    "type": {
                                      "type": "string",
                                      "enum": [
                                        "easing",
                                        "spring",
                                        "step"
                                      ]
                                    },
                                    "easing": {
                                      "type": "object",
                                      "properties": {
                                        "curve": {
                                          "type": "array",
                                          "items": {
                                            "type": "number"
                                          },
                                          "description": "cubic-bezier [x1,y1,x2,y2]"
                                        }
                                      }
                                    },
                                    "spring": {
                                      "type": "object",
                                      "properties": {
                                        "stiffness": {
                                          "type": "number"
                                        },
                                        "damping": {
                                          "type": "number"
                                        },
                                        "mass": {
                                          "type": "number"
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          },
                          "description": "track key → keyframes (time ascending)"
                        }
                      }
                    },
                    "description": "name → animation; use 'default' (the presentation timeline). See guide §10."
                  }
                }
              },
              "interaction": {
                "type": "object",
                "description": "REPLACES the container wholesale — read the node's rules first and send every rule it keeps. Rules fire top to bottom, actions in order. Guide §13.",
                "properties": {
                  "rules": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "description": "self-assigned, unique in the node, e.g. 'r1'"
                        },
                        "enabled": {
                          "type": "boolean",
                          "description": "default true"
                        },
                        "trigger": {
                          "type": "object",
                          "additionalProperties": true,
                          "description": "e.g. {type:'click'}, {type:'keyDown',key:'Enter'}, {type:'timer',delay:1000}",
                          "properties": {
                            "type": {
                              "type": "string",
                              "enum": [
                                "click",
                                "pointerEnter",
                                "pointerLeave",
                                "pointerDown",
                                "pointerUp",
                                "hovering",
                                "pressing",
                                "doubleClick",
                                "longPress",
                                "swipe",
                                "keyDown",
                                "sceneEnter",
                                "timer",
                                "stopReached",
                                "animationComplete",
                                "mediaEnded",
                                "mediaHit",
                                "variableChange",
                                "message"
                              ]
                            }
                          },
                          "required": [
                            "type"
                          ]
                        },
                        "conditions": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "additionalProperties": true,
                            "description": "{type:'variable',variableId,op,value} | {type:'state',state,declarerId?} — all must hold",
                            "properties": {
                              "type": {
                                "type": "string",
                                "enum": [
                                  "variable",
                                  "state"
                                ]
                              }
                            },
                            "required": [
                              "type"
                            ]
                          },
                          "description": "optional"
                        },
                        "actions": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "additionalProperties": true,
                            "description": "e.g. {type:'goToScene',sceneId}, {type:'play',name}, {type:'setState',state}, {type:'setVariable',variableId,op:'increment'}",
                            "properties": {
                              "type": {
                                "type": "string",
                                "enum": [
                                  "goToScene",
                                  "nextScene",
                                  "previousScene",
                                  "back",
                                  "endShow",
                                  "play",
                                  "stop",
                                  "setState",
                                  "timeline",
                                  "media",
                                  "openURL",
                                  "fetch",
                                  "setVariable",
                                  "resetVariables",
                                  "wait",
                                  "emit"
                                ]
                              }
                            },
                            "required": [
                              "type"
                            ]
                          }
                        }
                      },
                      "required": [
                        "id",
                        "trigger",
                        "actions"
                      ]
                    }
                  }
                }
              },
              "data": {
                "type": "object",
                "description": "text→text/fontFamily/fontSize/fontWeight/textAlign/verticalAlign/autoSize; rect→radius; circle→innerRadius; image/video/audio→src; stream→source/poster (guide §4.8); path→points/closed and a connector's ends and route (guide §4.3); table→its texts, tracks and looks (guide §14).",
                "properties": {
                  "text": {
                    "type": "string"
                  },
                  "fontFamily": {
                    "type": "string",
                    "description": "e.g. 'Pretendard'"
                  },
                  "fontSize": {
                    "type": "number"
                  },
                  "fontWeight": {
                    "type": "number",
                    "description": "400/500/700"
                  },
                  "textAlign": {
                    "type": "string",
                    "enum": [
                      "left",
                      "center",
                      "right"
                    ]
                  },
                  "verticalAlign": {
                    "type": "string",
                    "enum": [
                      "top",
                      "middle",
                      "bottom"
                    ]
                  },
                  "autoSize": {
                    "type": "boolean",
                    "description": "true = text grows to its content (titles/labels, no wrap). false = WRAP inside a fixed box — REQUIRED for body/paragraph text in a card/panel; set size.width to the container inner width or it overflows into neighbors."
                  },
                  "lineHeight": {
                    "type": "number"
                  },
                  "letterSpacing": {
                    "type": "number"
                  },
                  "radius": {
                    "type": "array",
                    "items": {
                      "type": "number"
                    },
                    "description": "rect/frame/table/stream [tl,tr,br,bl]"
                  },
                  "clip": {
                    "type": "boolean",
                    "description": "frame/table: clip children to the bounds (default true)"
                  },
                  "values": {
                    "type": "array",
                    "items": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "description": "table: cell texts by row; null keeps a cell"
                  },
                  "columns": {
                    "type": "array",
                    "items": {
                      "type": "object"
                    },
                    "description": "table: [{id, width}] — by id (a create: in order, no id)"
                  },
                  "rows": {
                    "type": "array",
                    "items": {
                      "type": "object"
                    },
                    "description": "table: [{id, height}] least heights — by id (a create: in order, no id)"
                  },
                  "cells": {
                    "type": "object",
                    "description": "table: 'rowId:colId' → {fill, borders:{top,right,bottom,left}, padding}; null = the table's look"
                  },
                  "lines": {
                    "type": "object",
                    "description": "table: inner lines {horizontal, vertical}"
                  },
                  "headerRows": {
                    "type": "object",
                    "description": "table: {count, fill} the top rows"
                  },
                  "bandRows": {
                    "type": "object",
                    "description": "table: {fill} every other body row"
                  },
                  "padding": {
                    "type": "array",
                    "items": {
                      "type": "number"
                    },
                    "description": "table: cell padding [t,r,b,l]"
                  },
                  "innerRadius": {
                    "type": "number",
                    "description": "circle (0 = disc)"
                  },
                  "src": {
                    "type": "string",
                    "description": "image/video/audio asset uri"
                  },
                  "source": {
                    "type": "object",
                    "properties": {
                      "kind": {
                        "type": "string",
                        "enum": [
                          "camera",
                          "screen"
                        ]
                      },
                      "id": {
                        "type": "string",
                        "description": "an existing source's id to show the same camera again; omit for a new one"
                      }
                    },
                    "description": "stream: its live source"
                  },
                  "fit": {
                    "type": "string",
                    "enum": [
                      "cover",
                      "contain"
                    ],
                    "description": "stream"
                  },
                  "mirror": {
                    "type": "boolean",
                    "description": "stream: flip (front camera)"
                  },
                  "muted": {
                    "type": "boolean",
                    "description": "video/stream"
                  },
                  "volume": {
                    "type": "number",
                    "description": "video/stream 0..1"
                  },
                  "poster": {
                    "type": "string",
                    "description": "stream: image asset uri"
                  },
                  "closed": {
                    "type": "boolean",
                    "description": "path"
                  },
                  "connectionStart": {
                    "type": "object",
                    "description": "connector end, whole; null detaches",
                    "properties": {
                      "objectId": {
                        "type": "string"
                      },
                      "position": {
                        "type": "object",
                        "properties": {
                          "x": {
                            "type": "number"
                          },
                          "y": {
                            "type": "number"
                          }
                        }
                      }
                    }
                  },
                  "connectionEnd": {
                    "type": "object",
                    "description": "connector end, whole; null detaches",
                    "properties": {
                      "objectId": {
                        "type": "string"
                      },
                      "position": {
                        "type": "object",
                        "properties": {
                          "x": {
                            "type": "number"
                          },
                          "y": {
                            "type": "number"
                          }
                        }
                      }
                    }
                  },
                  "connectionRoute": {
                    "type": "string",
                    "enum": [
                      "free",
                      "straight",
                      "curve",
                      "elbow"
                    ]
                  },
                  "connectionAvoid": {
                    "type": "boolean",
                    "description": "curve/elbow only"
                  },
                  "points": {
                    "type": "array",
                    "description": "path geometry; each point { type:\"move\"|\"line\"|\"quadratic\"|\"cubic\"|\"close\", x, y } — quadratic adds cx, cy; cubic adds cx1, cy1, cx2, cy2",
                    "items": {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "enum": [
                            "move",
                            "line",
                            "quadratic",
                            "cubic",
                            "close"
                          ]
                        },
                        "x": {
                          "type": "number"
                        },
                        "y": {
                          "type": "number"
                        },
                        "cx": {
                          "type": "number"
                        },
                        "cy": {
                          "type": "number"
                        },
                        "cx1": {
                          "type": "number"
                        },
                        "cy1": {
                          "type": "number"
                        },
                        "cx2": {
                          "type": "number"
                        },
                        "cy2": {
                          "type": "number"
                        }
                      }
                    }
                  }
                }
              },
              "notes": {
                "type": "string",
                "description": "scene/document"
              },
              "description": {
                "type": "string"
              },
              "type": {
                "type": "string",
                "description": "variable type"
              },
              "value": {
                "type": "string",
                "description": "variable value"
              },
              "clip": {
                "type": "boolean",
                "description": "scene: mask content to canvas bounds"
              }
            }
          },
          "index": {
            "type": "number",
            "description": "Table row/column ops: the first row/column, from 0 (an insert: omit = after the last)."
          },
          "count": {
            "type": "number",
            "description": "Table row/column ops: how many (default 1, or as many as values holds)."
          },
          "values": {
            "type": "array",
            "items": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "description": "insert_table_rows/columns: the new cells' texts by row."
          },
          "range": {
            "type": "object",
            "properties": {
              "rowIndex": {
                "type": "number"
              },
              "colIndex": {
                "type": "number"
              },
              "rowSpan": {
                "type": "number"
              },
              "colSpan": {
                "type": "number"
              }
            },
            "description": "merge/unmerge_table_cells: the cells, from 0 (spans default 1)."
          },
          "size": {
            "type": "object",
            "properties": {
              "width": {
                "type": "number"
              },
              "height": {
                "type": "number"
              }
            },
            "description": "Canvas size (set_scene_size)."
          },
          "newIndex": {
            "type": "number",
            "description": "Target index (move_scene, move_variable)."
          },
          "variableId": {
            "type": "string",
            "description": "Target variable id (update/delete/move variable)."
          },
          "options": {
            "type": "object",
            "additionalProperties": true,
            "description": "Op options: { index } = list position; { to } = move_object draw order: 'front'|'back'|'forward'|'backward' (last sibling paints on top); { parentObjectId } = create/move an object INTO a container (group/frame) — set it to the container's id, or to the alias a create earlier in THIS request gave itself."
          }
        }
      },
      "description": "Ordered mutations. They commit as a single undo step, so emit the whole change set in one call."
    },
    "reply": {
      "type": "string",
      "description": "Plain text in the language of the user's latest message, no markdown, at most 600 characters: one sentence on what you changed or why nothing changed — or, when the message was not an edit request, the answer itself."
    }
  }
}
```
