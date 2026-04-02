import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FarmSelector } from "../FarmSelector";

const farms = [
  {
    id: "farm-1",
    name: "Granja El Lago",
    org_id: "org-1",
    location: null,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "farm-2",
    name: "Granja Los Pinos",
    org_id: "org-1",
    location: null,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];

describe("FarmSelector", () => {
  it("renders the current farm name", () => {
    render(<FarmSelector farms={farms} currentFarmId="farm-1" onFarmChange={() => {}} />);
    expect(screen.getByText("Granja El Lago")).toBeInTheDocument();
  });

  it("renders without crashing when farms list is empty", () => {
    render(<FarmSelector farms={[]} currentFarmId="" onFarmChange={() => {}} />);
    expect(document.querySelector("[data-slot='select-trigger']")).toBeInTheDocument();
  });
});
