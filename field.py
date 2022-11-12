import random
import dataclasses
import time

MAX_MINES_PCT = 0.5
MIN_FIELD_SIZE = 5
MAX_FIELD_SIZE = 64


@dataclasses.dataclass
class Cell:
    content: int  # 0 - no mines around, 8 - 8 mines around, -1 - mine, -2 - exploded mine
    state: int  # 0 - hidden, 1 - revealed, 2 - flagged, 3 - false flagged


_field: list[list[Cell]] = None
_width: int = 9
_height: int = 9
_mine_count: int = 0
_flags_count: int = 0
_revealed_count: int = 0
_start_time: float = None
_victory: bool = False
_game_over: bool = False
_game_finish_time: int = None

_preview_pos: tuple[int, int] = None


def get_field_width() -> int:
    return _width


def get_field_height() -> int:
    return _height


def get_mines_left() -> int:
    return max(_mine_count - _flags_count, 0)


def get_time() -> int:
    if _game_over or _victory:
        return _game_finish_time
    if _start_time is None:
        return 0
    return int(time.monotonic() - _start_time)


def get_cell_state(x: int, y: int) -> tuple[int, int]:
    return _field[x][y].content, _field[x][y].state


def game_won() -> bool:
    return _victory


def game_over() -> bool:
    return _game_over


def start_game(width: int, height: int, mine_count: int):
    global _field, _mine_count, _flags_count, _revealed_count, _start_time, _victory, _game_over, _game_finish_time, _preview_pos

    if width < MIN_FIELD_SIZE or height < MIN_FIELD_SIZE:
        raise ValueError(f'Requested field size is too small.\nMinimum dimension is {MIN_FIELD_SIZE}')
    if width > MAX_FIELD_SIZE or height > MAX_FIELD_SIZE:
        raise ValueError(f'Requested field size is too big.\nMaximum dimension is {MAX_FIELD_SIZE}')
    if mine_count > width * height * MAX_MINES_PCT:
        raise ValueError(f'Requested mine count is too large.\n Mine count cannot exceed cell count times {MAX_MINES_PCT}')

    _field = [[Cell(content=0, state=0) for _ in range(height)] for _ in range(width)]

    c = 0
    while c < mine_count:
        x, y = random.randint(0, width - 1), random.randint(0, height - 1)
        if _field[x][y].content != 0:
            continue
        _field[x][y].content = -1
        c += 1

    for x in range(width):
        for y in range(height):
            if _field[x][y].content != 0:
                continue

            _field[x][y].content = _count_neighboors(x, y)

    _mine_count = mine_count
    _flags_count = _revealed_count = 0
    _victory = _game_over = False
    _start_time = _game_finish_time = None
    _preview_pos = None


def _count_neighboors(x: int, y: int) -> int:
    count = 0
    if y > 0:
        count += _field[x][y - 1].content == -1
    if y < _height - 1:
        count += _field[x][y + 1].content == -1

    if x > 0:
        count += _field[x - 1][y].content == -1
        if y > 0:
            count += _field[x - 1][y - 1].content == -1
        if y < _height - 1:
            count += _field[x - 1][y + 1].content == -1

    if x < _width - 1:
        count += _field[x + 1][y].content == -1
        if y > 0:
            count += _field[x + 1][y - 1].content == -1
        if y < _height - 1:
            count += _field[x + 1][y + 1].content == -1
    return count


def flag_cell(x: int, y: int):
    global _flags_count

    if _game_over or _victory:
        return

    if _field[x][y].state == 1:
        return

    if _field[x][y].state == 2:
        _field[x][y].state = 0
        _flags_count -= 1
    else:
        _field[x][y].state = 2
        _flags_count += 1


def reveal_cell(x: int, y: int) -> bool:
    """
    :return: True if exploded on revealed mine
    TODO: first reveal cannot hit a bomb
    """
    global _start_time, _game_over, _game_finish_time, _victory

    if _game_over or _victory:
        return

    if _field[x][y].state == 2 or _field[x][y].state == 1:
        return

    if _field[x][y].content == -1:
        if _start_time is not None:
            _field[x][y].content = -2
            _game_finish_time = get_time()
            _game_over = True
            game_over_reveal()
            return

        while True:
            new_x, new_y = random.randint(0, _width - 1), random.randint(0, _height - 1)
            if new_x == x and new_y == y:
                continue
            if _field[new_x][new_y].content < 0:
                continue
            _field[new_x][new_y].content = -1
            _field[x][y].content = _count_neighboors(x, y)
            break

    if _start_time is None:
        _start_time = time.monotonic()

    reveal_emply_cell(x, y)

    if _width * _height - _mine_count == _revealed_count:
        # Victory!
        _game_finish_time = get_time()
        _victory = True
        victory_flag()


def reveal_emply_cell(x: int, y: int):
    global _revealed_count

    if _field[x][y].content > 0:
        if _field[x][y].state == 0:
            _field[x][y].state = 1
            _revealed_count += 1
        return

    visited: set[tuple[int, int]] = set()
    to_visit: list[tuple[int, int]] = [(x, y)]
    while len(to_visit) > 0:
        x, y = to_visit.pop()
        if x < 0 or y < 0 or x >= _width or y >= _height:
            continue
        if (x, y) in visited:
            continue

        if _field[x][y].state == 0:
            _field[x][y].state = 1
            _revealed_count += 1
        visited.add((x, y))

        if _field[x][y].content != 0:
            continue
        to_visit.extend(
            (
                (x - 1, y),
                (x + 1, y),
                (x - 1, y - 1),
                (x + 1, y + 1),
                (x - 1, y + 1),
                (x + 1, y - 1),
                (x, y - 1),
                (x, y + 1),
            )
        )


def game_over_reveal():
    for row in _field:
        for cell in row:
            if -2 <= cell.content <= -1 and cell.state == 0:
                cell.state = 1
            if 0 <= cell.content <= 8 and cell.state == 2:
                cell.state = 3


def victory_flag():
    for row in _field:
        for cell in row:
            if cell.content == -1:
                cell.state = 2


def set_preview(x: int, y: int):
    global _preview_pos
    if _game_over or _victory:
        return

    if 0 <= _field[x][y].state <= 1:
        _preview_pos = x, y
    else:
        _preview_pos = None


def clear_preview():
    global _preview_pos
    _preview_pos = None


def is_preview(x: int, y: int):
    if _preview_pos is None:
        return False

    if _field[_preview_pos[0]][_preview_pos[1]].state == 0:  # hidden
        return (x, y) == _preview_pos
    elif _field[_preview_pos[0]][_preview_pos[1]].state == 1 and _field[_preview_pos[0]][_preview_pos[1]].content > 0:  # number
        return abs(x - _preview_pos[0]) < 2 and abs(y - _preview_pos[1]) < 2 and _field[x][y].state == 0
    return False
