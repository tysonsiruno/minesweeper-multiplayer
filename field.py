import random
import dataclasses

MAX_MINES_PCT = 0.5
MIN_FIELD_SIZE = 5
MAX_FIELD_SIZE = 64


@dataclasses.dataclass
class Cell:
    content: int  # 0 - no mines around, 8 - 8 mines around, -1 - mine, -2 - exploded mine
    state: int  # 0 - hidden, 1 - revealed, 2 - flagged


_field: list[list[Cell]] = None


def get_field_width() -> int:
    return len(_field)


def get_field_height() -> int:
    return len(_field[0])


def start_game(width: int, height: int, mine_count: int):
    global _field

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

            _field[x][y].content = _count_neighboors(x, y, width, height)


def _count_neighboors(x: int, y: int, width: int, height: int) -> int:
    count = 0
    if y > 0:
        count += _field[x][y - 1].content == -1
    if y < height - 1:
        count += _field[x][y + 1].content == -1

    if x > 0:
        count += _field[x - 1][y].content == -1
        if y > 0:
            count += _field[x - 1][y - 1].content == -1
        if y < height - 1:
            count += _field[x - 1][y + 1].content == -1

    if x < width - 1:
        count += _field[x + 1][y].content == -1
        if y > 0:
            count += _field[x + 1][y - 1].content == -1
        if y < height - 1:
            count += _field[x + 1][y + 1].content == -1
    return count


def flag_cell(x: int, y: int):
    if _field[x][y].state == 1:
        return
    _field[x][y].state = 0 if _field[x][y].state == 2 else 2


def reveal_cell(x: int, y: int) -> bool:
    """
    :return: True if exploded on revealed mine
    """
    if _field[x][y].state == 2:
        return False
    if _field[x][y].state == 1:
        return False

    if _field[x][y].content == -1:
        _field[x][y].content = -2
        return True

    if _field[x][y].content > 0:
        _field[x][y].state = 1
        return False

    visited: set[tuple[int, int]] = {}
    to_visit: list[tuple[int, int]] = {(x, y)}
    while len(to_visit) > 0:
        x, y = to_visit.pop()
        if (x, y) in visited or x < 0 or y < 0 or x >= len(_field) or y >= len(_field[0]):
            continue

        _field[x][y].state = 1
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

    return False


def game_over_reveal():
    for row in _field:
        for cell in row:
            if cell.content == -1 and cell.state == 0:
                cell.state = 1
            if 0 <= cell.content <= 8 and cell.state == 2:
                cell.state = 3
