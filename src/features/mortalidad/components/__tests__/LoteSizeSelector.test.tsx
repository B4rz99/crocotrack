import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoteSizeSelector } from "@/shared/components/LoteSizeSelector";

const compositions = [
  { size_inches: 12, animal_count: 80 },
  { size_inches: 18, animal_count: 40 },
];

describe("LoteSizeSelector", () => {
  it("renders a row for each size in the composition", () => {
    render(<LoteSizeSelector compositions={compositions} onChange={vi.fn()} />);
    expect(screen.getByText(/12 pulgadas/i)).toBeInTheDocument();
    expect(screen.getByText(/18 pulgadas/i)).toBeInTheDocument();
  });

  it("shows the available count next to each size", () => {
    render(<LoteSizeSelector compositions={compositions} onChange={vi.fn()} />);
    expect(screen.getByText(/80 disponibles/i)).toBeInTheDocument();
    expect(screen.getByText(/40 disponibles/i)).toBeInTheDocument();
  });

  it("calls onChange with only sizes that have deaths > 0", async () => {
    const onChange = vi.fn();
    render(<LoteSizeSelector compositions={compositions} onChange={onChange} />);

    const inputs = screen.getAllByRole("spinbutton");
    await userEvent.clear(inputs[0]!);
    await userEvent.type(inputs[0]!, "3");

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(lastCall).toEqual([{ size_inches: 12, animal_count: 3 }]);
    // 18" not included because its count is 0
  });

  it("does not include a size when its death count is cleared to 0", async () => {
    const onChange = vi.fn();
    render(<LoteSizeSelector compositions={compositions} onChange={onChange} />);

    const inputs = screen.getAllByRole("spinbutton");

    // Enter 5 then clear back to 0
    await userEvent.clear(inputs[1]!);
    await userEvent.type(inputs[1]!, "5");
    await userEvent.clear(inputs[1]!);
    await userEvent.type(inputs[1]!, "0");

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(lastCall).toHaveLength(0);
  });

  it("constrains the max value of each input to the available count", () => {
    render(<LoteSizeSelector compositions={compositions} onChange={vi.fn()} />);
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[0]).toHaveAttribute("max", "80");
    expect(inputs[1]).toHaveAttribute("max", "40");
  });

  it("renders an empty state message when compositions is empty", () => {
    render(<LoteSizeSelector compositions={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/sin composición de tallas/i)).toBeInTheDocument();
  });

  it("shows a compositions error from errors prop", () => {
    render(
      <LoteSizeSelector
        compositions={compositions}
        onChange={vi.fn()}
        errors={{ compositions: "Debe reportar al menos una baja" }}
      />
    );
    expect(screen.getByText("Debe reportar al menos una baja")).toBeInTheDocument();
  });
});
