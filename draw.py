import pygame
import pygame.image
from pygame import Surface

import field

border_tl: Surface
border_tr: Surface
border_tm: Surface
border_tf: Surface
border_l: Surface
border_r: Surface
border_bl: Surface
border_b: Surface
border_br: Surface

face_normal: Surface
face_cool: Surface
face_oh: Surface
face_dead: Surface

numbers: list[pygame.Surface]
tile_hidden: Surface
tile_flag: Surface
tile_false_flag: Surface
tiles: list[pygame.Surface]


def load_assets():
    global border_tl, border_tr, border_tm, border_tf, border_l, border_r, border_bl, border_b, border_br
    border_tl = pygame.image.load('assets/border_top_left.png')
    border_tr = pygame.image.load('assets/border_top_right.png')
    border_tm = pygame.image.load('assets/border_top_mid.png')
    border_tf = pygame.image.load('assets/border_top_fill.png')

    border_l = pygame.image.load('assets/border_left.png')
    border_r = pygame.image.load('assets/border_right.png')
    border_bl = pygame.image.load('assets/border_bottom_left.png')
    border_b = pygame.image.load('assets/border_bottom.png')
    border_br = pygame.image.load('assets/border_bottom_right.png')

    global face_normal, face_cool, face_oh, face_dead
    face_normal = pygame.image.load('assets/face_n.png')
    face_cool = pygame.image.load('assets/face_c.png')
    face_oh = pygame.image.load('assets/face_o.png')
    face_dead = pygame.image.load('assets/face_x.png')

    global numbers
    numbers = [
        pygame.image.load('assets/number_0.png'),
        pygame.image.load('assets/number_1.png'),
        pygame.image.load('assets/number_2.png'),
        pygame.image.load('assets/number_3.png'),
        pygame.image.load('assets/number_4.png'),
        pygame.image.load('assets/number_5.png'),
        pygame.image.load('assets/number_6.png'),
        pygame.image.load('assets/number_7.png'),
        pygame.image.load('assets/number_8.png'),
        pygame.image.load('assets/number_9.png'),
    ]

    global tile_hidden, tile_flag, tile_false_flag, tiles
    tile_hidden = pygame.image.load('assets/tile_hidden.png')
    tile_flag = pygame.image.load('assets/tile_flag.png')
    tile_false_flag = pygame.image.load('assets/tile_false_flag.png')
    tiles = [
        pygame.image.load('assets/tile_0.png'),
        pygame.image.load('assets/tile_1.png'),
        pygame.image.load('assets/tile_2.png'),
        pygame.image.load('assets/tile_3.png'),
        pygame.image.load('assets/tile_4.png'),
        pygame.image.load('assets/tile_5.png'),
        pygame.image.load('assets/tile_6.png'),
        pygame.image.load('assets/tile_7.png'),
        pygame.image.load('assets/tile_8.png'),
        pygame.image.load('assets/tile_boom.png'),
        pygame.image.load('assets/tile_mine.png'),
    ]


_screen: pygame.Surface = None


def set_screen(field_width: int, field_height: int):
    global _screen
    scr_w, scr_h = field_width * 16 + 4 * 2, field_height * 16 + 44

    if _screen is not None:
        w, h = _screen.get_size()
        if scr_w == w and scr_h == h:
            return
    _screen = pygame.display.set_mode((scr_w, scr_h), pygame.SCALED | pygame.RESIZABLE)


def draw_screen():
    draw_borders(_screen)
    draw_field(_screen)
    draw_mine_count(_screen)
    draw_timer(_screen)
    draw_face(_screen)


def draw_borders(screen: pygame.Surface):
    w, h = field.get_field_width(), field.get_field_height()
    scr_w, scr_h = screen.get_size()

    # draw corners
    screen.blit(border_tl, (0, 0))
    screen.blit(border_tr, (scr_w - 52, 0))
    screen.blit(border_bl, (0, scr_h - 4))
    screen.blit(border_br, (scr_w - 4, scr_h - 4))

    for y in range(h):
        screen.blit(border_l, (0, y * 16 + 40))
        screen.blit(border_r, (scr_w - 4, y * 16 + 40))

    for x in range(w):
        screen.blit(border_b, (x * 16 + 4, scr_h - 4))
        if 3 <= x < w - 3:
            screen.blit(border_tf, (x * 16 + 4, 0))

    screen.blit(border_tm, (scr_w // 2 - 16, 0))


def draw_field(screen: pygame.Surface):
    w, h = field.get_field_width(), field.get_field_height()
    for x in range(w):
        for y in range(h):
            contents, state = field.get_cell_state(x, y)
            pos = x * 16 + 4, y * 16 + 40
            if state == 0:
                if field.in_preview(x, y):
                    screen.blit(tiles[0], pos)  # preview hidden
                else:
                    screen.blit(tile_hidden, pos)  # normal hidden
            elif state == 2:
                screen.blit(tile_flag, pos)
            elif state == 3:
                screen.blit(tile_false_flag, pos)
            else:
                screen.blit(tiles[contents], pos)


def draw_mine_count(screen: pygame.Surface):
    draw_number(screen, field.get_mines_left(), 9, 9)


def draw_timer(screen: pygame.Surface):
    scr_w, _ = screen.get_size()
    draw_number(screen, field.get_time(), scr_w - 45, 9)


def draw_number(screen: pygame.Surface, number: int, x: int, y: int):
    screen.blit(numbers[number % 10], (x + 26, y))
    if number > 9:
        screen.blit(numbers[(number // 10) % 10], (x + 13, y))
    if number > 99:
        screen.blit(numbers[(number // 100) % 10], (x, y))


def draw_face(screen: pygame.Surface):
    scr_w, _ = screen.get_size()
    pos = scr_w // 2 - 11, 7
    if field.game_over():
        screen.blit(face_dead, pos)
    elif field.game_won():
        screen.blit(face_cool, pos)
    elif field.is_preview():
        screen.blit(face_oh, pos)
    else:
        screen.blit(face_normal, pos)


def is_face(x: int, y: int) -> bool:
    scr_w, _ = _screen.get_size()
    return scr_w // 2 - 11 <= x < scr_w // 2 + 11 and 7 <= y < 29
